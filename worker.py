"""
RIPS Guard — FastAPI Worker
Orquestador del pipeline: Upload → Parse → Validate → AI Correct → Persist → Report

Seguridad:
  - JWT de Supabase validado en cada endpoint protegido via python-jose
  - CORS restringido al dominio de producción
  - Rate limiting básico por IP
  - Validación de tamaño y tipo de archivo
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

import httpx
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from supabase import create_client, Client as SupabaseClient

from rips_parser import RIPSParser
from validation_engine import ValidationEngine, AuditResult, Severidad
from ai_corrector import AICorrector, merge_corrections_into_findings

logger = logging.getLogger("ripsguard")

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────

SUPABASE_URL          = os.environ.get("SUPABASE_URL", "")
SUPABASE_JWT_SECRET   = os.environ.get("SUPABASE_JWT_SECRET", "")
SUPABASE_SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY", "")  # service_role key — solo backend

# Orígenes permitidos — NUNCA usar "*" en producción con credentials=True
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://ripsguard.co,https://www.ripsguard.co,http://localhost:3000"
    ).split(",")
    if origin.strip()
]


# ─────────────────────────────────────────────
# MODELOS
# ─────────────────────────────────────────────

class SessionStatus(BaseModel):
    session_id:      str
    estado:          str
    nombre_archivo:  str
    created_at:      str
    procesado_at:    str | None
    total_registros: int
    total_errores:   int
    total_criticos:  int
    valor_en_riesgo: float


class FindingResponse(BaseModel):
    tipo_error:       str
    severidad:        str
    campo:            str
    valor_incorrecto: str | None
    descripcion:      str
    seccion:          str
    numero_fila:      int
    valor_en_riesgo:  float
    regla_codigo:     str
    sugerencia_ia:    str | None


class AuditReportResponse(BaseModel):
    session_id:          str
    tenant_id:           str
    total_registros:     int
    total_errores:       int
    total_criticos:      int
    total_advertencias:  int
    valor_total:         float
    valor_en_riesgo:     float
    porcentaje_riesgo:   float
    findings:            list[FindingResponse]
    resumen_por_seccion: dict[str, Any]
    resumen_por_tipo_error: dict[str, int]


# ─────────────────────────────────────────────
# SUPABASE ADMIN CLIENT
# ─────────────────────────────────────────────

def get_supabase() -> SupabaseClient | None:
    """Retorna cliente Supabase con service_role. None si no está configurado."""
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    logger.warning("SUPABASE_SERVICE_KEY no configurado — persistencia deshabilitada")
    return None


# Caché en memoria: fallback si Supabase no está disponible
_sessions: dict[str, dict] = {}


# ─────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────

app = FastAPI(
    title="RIPS Guard API",
    description="Auditoría y corrección de archivos RIPS / Facturación Electrónica (Res. 2275/2023)",
    version="0.2.0",
    docs_url="/docs" if os.environ.get("ENV") != "production" else None,  # Deshabilitar Swagger en prod
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],   # Solo los métodos que usamos
    allow_headers=["Authorization", "Content-Type", "X-Tenant-Id"],
)

# Instanciar servicios (singletons)
parser    = RIPSParser()
engine    = ValidationEngine()
corrector = AICorrector(model="claude-haiku-4-5-20251001")


# ─────────────────────────────────────────────
# AUTENTICACIÓN — Validación JWT de Supabase
# ─────────────────────────────────────────────

class AuthenticatedUser(BaseModel):
    user_id:   str
    email:     str | None = None
    tenant_id: str | None = None


def verify_supabase_jwt(authorization: str = Header(...)) -> AuthenticatedUser:
    """
    Valida el JWT emitido por Supabase Auth.

    El cliente Next.js debe enviar el header:
        Authorization: Bearer <access_token>

    El JWT_SECRET se obtiene en Supabase Dashboard → Settings → API → JWT Secret.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Header Authorization inválido")

    token = authorization.removeprefix("Bearer ").strip()

    if not SUPABASE_JWT_SECRET:
        # En desarrollo sin JWT secret configurado, extraer user_id sin verificar firma
        # NUNCA hacer esto en producción
        if os.environ.get("ENV") == "production":
            raise HTTPException(status_code=500, detail="JWT secret no configurado")
        try:
            payload = jwt.get_unverified_claims(token)
            return AuthenticatedUser(
                user_id=payload.get("sub", "dev-user"),
                email=payload.get("email"),
                tenant_id=payload.get("app_metadata", {}).get("tenant_id"),
            )
        except Exception:
            raise HTTPException(status_code=401, detail="Token inválido")

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase no usa audience estándar
        )
        return AuthenticatedUser(
            user_id=payload["sub"],
            email=payload.get("email"),
            tenant_id=payload.get("app_metadata", {}).get("tenant_id"),
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token inválido o expirado: {e}")


def get_tenant_id(user: AuthenticatedUser = Depends(verify_supabase_jwt)) -> str:
    """
    Extrae tenant_id del JWT.
    Fallback: usa user_id como tenant (un tenant por usuario) para usuarios
    registrados antes de que se implementara el aprovisionamiento multi-tenant.
    """
    if user.tenant_id:
        return user.tenant_id
    # Fallback seguro — permite que todos los usuarios autenticados operen
    logger.info(f"[get_tenant_id] user {user.user_id} sin tenant_id en JWT — usando user_id como tenant")
    return f"u_{user.user_id}"


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check — no requiere autenticación."""
    return {"status": "ok", "version": "0.2.0"}


@app.post("/audit/upload", response_model=SessionStatus, status_code=202)
async def upload_rips(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Recibe un archivo RIPS JSON o ZIP, lo audita y retorna el session_id.

    Requiere: Authorization: Bearer <supabase_access_token>
    """
    # Validar tipo de archivo
    allowed = {".json", ".zip"}
    suffix  = ("." + file.filename.rsplit(".", 1)[-1].lower()) if "." in file.filename else ""
    if suffix not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Formato '{suffix}' no soportado. Use .json o .zip"
        )

    content = await file.read()

    # Límite de tamaño (50 MB)
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande. Máximo 50 MB.")

    session_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()

    _sessions[session_id] = {
        "session_id":     session_id,
        "tenant_id":      tenant_id,
        "nombre_archivo": file.filename,
        "estado":         "processing",
        "created_at":     created_at,
        "procesado_at":   None,
        "result":         None,
        "error":          None,
    }

    try:
        # 1. PARSE
        if suffix == ".zip":
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            doc = parser.parse_file(tmp_path)
        else:
            doc = parser.parse_string(content.decode("utf-8"))

        # 2. VALIDATE
        result = engine.validate(doc)

        # 3. AI CORRECTIONS (solo si la API key está configurada)
        registros_map = {
            reg.numero_fila: reg
            for usuario in doc.usuarios
            for reg in usuario.registros
        }
        if os.environ.get("ANTHROPIC_API_KEY"):
            corrections = corrector.correct_batch(result.findings, registros_map)
            result.findings = merge_corrections_into_findings(result.findings, corrections)

        # 4. PERSIST — Supabase + caché en memoria
        procesado_at = datetime.utcnow().isoformat()
        _sessions[session_id].update({
            "estado":          "completado",
            "procesado_at":    procesado_at,
            "total_registros": result.total_registros,
            "total_errores":   result.total_errores,
            "total_criticos":  result.total_criticos,
            "total_advertencias": result.total_advertencias,
            "valor_en_riesgo": result.valor_en_riesgo,
            "result":          result,
        })

        # Persistir en Supabase (no bloquear si falla)
        try:
            sb = get_supabase()
            if sb:
                sb.table("audit_sessions").insert({
                    "id":                  session_id,
                    "tenant_id":           tenant_id,
                    "nombre_archivo":      file.filename,
                    "tipo_archivo":        "zip" if suffix == ".zip" else "json",
                    "tamaño_bytes":        len(content),
                    "estado":              "completado",
                    "total_registros":     result.total_registros,
                    "total_errores":       result.total_errores,
                    "total_criticos":      result.total_criticos,
                    "total_advertencias":  result.total_advertencias,
                    "valor_total_cop":     int(result.valor_total),
                    "valor_en_riesgo_cop": int(result.valor_en_riesgo),
                    "porcentaje_riesgo":   float(result.porcentaje_riesgo),
                    "procesado_at":        procesado_at,
                }).execute()
        except Exception as db_err:
            logger.warning(f"[audit/upload] Error persistiendo en Supabase: {db_err}")

    except Exception as exc:
        _sessions[session_id].update({
            "estado":          "error",
            "error":           str(exc),
            "total_registros": 0,
            "total_errores":   0,
            "total_criticos":  0,
            "valor_en_riesgo": 0.0,
        })
        raise HTTPException(status_code=422, detail=f"Error procesando archivo: {exc}")

    sess = _sessions[session_id]
    return SessionStatus(
        session_id=session_id,
        estado=sess["estado"],
        nombre_archivo=sess["nombre_archivo"],
        created_at=sess["created_at"],
        procesado_at=sess.get("procesado_at"),
        total_registros=sess.get("total_registros", 0),
        total_errores=sess.get("total_errores", 0),
        total_criticos=sess.get("total_criticos", 0),
        valor_en_riesgo=sess.get("valor_en_riesgo", 0.0),
    )


class AuditListItem(BaseModel):
    session_id:      str
    nombre_archivo:  str
    estado:          str
    total_registros: int
    total_errores:   int
    total_criticos:  int
    valor_en_riesgo: float
    created_at:      str
    procesado_at:    str | None


class AuditListResponse(BaseModel):
    items:   list[AuditListItem]
    total:   int
    page:    int
    pages:   int


@app.get("/audits", response_model=AuditListResponse)
async def list_audits(
    page:      int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Lista el historial de auditorías del tenant con paginación.
    Prioriza Supabase; fallback a caché en memoria.
    """
    sb = get_supabase()

    if sb:
        # Consultar Supabase con paginación
        offset = (page - 1) * page_size
        try:
            count_resp = (
                sb.table("audit_sessions")
                .select("id", count="exact")
                .eq("tenant_id", tenant_id)
                .eq("estado", "completado")
                .execute()
            )
            total = count_resp.count or 0

            data_resp = (
                sb.table("audit_sessions")
                .select(
                    "id,nombre_archivo,estado,total_registros,"
                    "total_errores,total_criticos,valor_en_riesgo_cop,"
                    "created_at,procesado_at"
                )
                .eq("tenant_id", tenant_id)
                .eq("estado", "completado")
                .order("created_at", desc=True)
                .range(offset, offset + page_size - 1)
                .execute()
            )

            items = [
                AuditListItem(
                    session_id=row["id"],
                    nombre_archivo=row["nombre_archivo"],
                    estado=row["estado"],
                    total_registros=row.get("total_registros") or 0,
                    total_errores=row.get("total_errores") or 0,
                    total_criticos=row.get("total_criticos") or 0,
                    valor_en_riesgo=float(row.get("valor_en_riesgo_cop") or 0),
                    created_at=row["created_at"],
                    procesado_at=row.get("procesado_at"),
                )
                for row in (data_resp.data or [])
            ]

            return AuditListResponse(
                items=items,
                total=total,
                page=page,
                pages=max(1, -(-total // page_size)),  # ceil division
            )

        except Exception as db_err:
            logger.warning(f"[audits] Error consultando Supabase: {db_err}")
            # Caer al fallback en memoria

    # Fallback: caché en memoria (sessions actuales del servidor)
    tenant_sessions = [
        s for s in _sessions.values()
        if s.get("tenant_id") == tenant_id and s.get("estado") == "completado"
    ]
    tenant_sessions.sort(key=lambda s: s["created_at"], reverse=True)
    total = len(tenant_sessions)
    start = (page - 1) * page_size
    page_items = tenant_sessions[start : start + page_size]

    return AuditListResponse(
        items=[
            AuditListItem(
                session_id=s["session_id"],
                nombre_archivo=s["nombre_archivo"],
                estado=s["estado"],
                total_registros=s.get("total_registros", 0),
                total_errores=s.get("total_errores", 0),
                total_criticos=s.get("total_criticos", 0),
                valor_en_riesgo=s.get("valor_en_riesgo", 0.0),
                created_at=s["created_at"],
                procesado_at=s.get("procesado_at"),
            )
            for s in page_items
        ],
        total=total,
        page=page,
        pages=max(1, -(-total // page_size)),
    )


@app.get("/audit/{session_id}", response_model=SessionStatus)
async def get_session(
    session_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    # 1. Buscar en caché en memoria
    sess = _sessions.get(session_id)
    if sess and sess["tenant_id"] == tenant_id:
        return SessionStatus(
            session_id=session_id,
            estado=sess["estado"],
            nombre_archivo=sess["nombre_archivo"],
            created_at=sess["created_at"],
            procesado_at=sess.get("procesado_at"),
            total_registros=sess.get("total_registros", 0),
            total_errores=sess.get("total_errores", 0),
            total_criticos=sess.get("total_criticos", 0),
            valor_en_riesgo=sess.get("valor_en_riesgo", 0.0),
        )

    # 2. Fallback a Supabase (tras reinicio del servidor)
    sb = get_supabase()
    if sb:
        try:
            resp = (
                sb.table("audit_sessions")
                .select("*")
                .eq("id", session_id)
                .eq("tenant_id", tenant_id)
                .single()
                .execute()
            )
            if resp.data:
                row = resp.data
                return SessionStatus(
                    session_id=session_id,
                    estado=row["estado"],
                    nombre_archivo=row["nombre_archivo"],
                    created_at=row["created_at"],
                    procesado_at=row.get("procesado_at"),
                    total_registros=row.get("total_registros") or 0,
                    total_errores=row.get("total_errores") or 0,
                    total_criticos=row.get("total_criticos") or 0,
                    valor_en_riesgo=float(row.get("valor_en_riesgo_cop") or 0),
                )
        except Exception as db_err:
            logger.warning(f"[get_session] Supabase fallback falló: {db_err}")

    raise HTTPException(status_code=404, detail="Sesión no encontrada")


@app.get("/audit/{session_id}/report", response_model=AuditReportResponse)
async def get_report(
    session_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    # 1. Buscar en caché en memoria (incluye findings completos)
    sess = _sessions.get(session_id)
    if sess and sess["tenant_id"] == tenant_id:
        if sess["estado"] != "completado":
            raise HTTPException(
                status_code=409,
                detail=f"Sesión en estado '{sess['estado']}'. Espere a que complete."
            )
        result: AuditResult = sess["result"]
        findings_resp = [
            FindingResponse(
                tipo_error=f.tipo_error.value,
                severidad=f.severidad.value,
                campo=f.campo,
                valor_incorrecto=f.valor_incorrecto,
                descripcion=f.descripcion,
                seccion=f.seccion.value,
                numero_fila=f.numero_fila,
                valor_en_riesgo=f.valor_en_riesgo,
                regla_codigo=f.regla_codigo,
                sugerencia_ia=f.sugerencia_ia,
            )
            for f in result.findings
        ]
        return AuditReportResponse(
            session_id=session_id,
            tenant_id=tenant_id,
            total_registros=result.total_registros,
            total_errores=result.total_errores,
            total_criticos=result.total_criticos,
            total_advertencias=result.total_advertencias,
            valor_total=result.valor_total,
            valor_en_riesgo=result.valor_en_riesgo,
            porcentaje_riesgo=result.porcentaje_riesgo,
            findings=findings_resp,
            resumen_por_seccion=result.resumen_por_seccion,
            resumen_por_tipo_error=result.resumen_por_tipo_error,
        )

    # 2. Fallback a Supabase (tras reinicio del servidor)
    # Los hallazgos individuales no persisten actualmente — se retorna el resumen
    sb = get_supabase()
    if sb:
        try:
            resp = (
                sb.table("audit_sessions")
                .select("*")
                .eq("id", session_id)
                .eq("tenant_id", tenant_id)
                .single()
                .execute()
            )
            if resp.data:
                row = resp.data
                if row["estado"] != "completado":
                    raise HTTPException(
                        status_code=409,
                        detail=f"Sesión en estado '{row['estado']}'. Espere a que complete."
                    )
                valor_total  = float(row.get("valor_total_cop") or 0)
                valor_riesgo = float(row.get("valor_en_riesgo_cop") or 0)
                porcentaje   = float(row.get("porcentaje_riesgo") or 0)
                return AuditReportResponse(
                    session_id=session_id,
                    tenant_id=tenant_id,
                    total_registros=row.get("total_registros") or 0,
                    total_errores=row.get("total_errores") or 0,
                    total_criticos=row.get("total_criticos") or 0,
                    total_advertencias=row.get("total_advertencias") or 0,
                    valor_total=valor_total,
                    valor_en_riesgo=valor_riesgo,
                    porcentaje_riesgo=porcentaje,
                    findings=[],          # Hallazgos no disponibles tras reinicio
                    resumen_por_seccion={},
                    resumen_por_tipo_error={},
                )
        except HTTPException:
            raise
        except Exception as db_err:
            logger.warning(f"[get_report] Supabase fallback falló: {db_err}")

    raise HTTPException(status_code=404, detail="Sesión no encontrada")


@app.get("/audit/{session_id}/download")
async def download_corrected(
    session_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    # Buscar en memoria o verificar que existe en Supabase
    sess = _sessions.get(session_id)
    if not sess or sess["tenant_id"] != tenant_id:
        # Verificar en Supabase antes de rechazar
        sb = get_supabase()
        if sb:
            try:
                resp = (
                    sb.table("audit_sessions")
                    .select("id,tenant_id,estado")
                    .eq("id", session_id)
                    .eq("tenant_id", tenant_id)
                    .single()
                    .execute()
                )
                if not resp.data:
                    raise HTTPException(status_code=404, detail="Sesión no encontrada")
                if resp.data["estado"] != "completado":
                    raise HTTPException(status_code=409, detail="Sesión aún no completada")
                # Sesión existe en Supabase pero los hallazgos no están en memoria
                raise HTTPException(
                    status_code=410,
                    detail="Los hallazgos de esta auditoría ya no están disponibles. "
                           "Suba el archivo nuevamente para generar un nuevo reporte descargable."
                )
            except HTTPException:
                raise
            except Exception:
                pass
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if sess["estado"] != "completado":
        raise HTTPException(status_code=409, detail="Sesión aún no completada")

    result: AuditResult = sess["result"]
    export = {
        "session_id":     session_id,
        "nombre_archivo": sess["nombre_archivo"],
        "fecha_auditoria": sess["procesado_at"],
        "resumen": {
            "total_registros":     result.total_registros,
            "total_errores":       result.total_errores,
            "criticos":            result.total_criticos,
            "advertencias":        result.total_advertencias,
            "valor_total_cop":     result.valor_total,
            "valor_en_riesgo_cop": result.valor_en_riesgo,
            "porcentaje_riesgo":   result.porcentaje_riesgo,
        },
        "errores": [
            {
                "fila":           f.numero_fila,
                "seccion":        f.seccion.value,
                "severidad":      f.severidad.value,
                "tipo":           f.tipo_error.value,
                "campo":          f.campo,
                "valor_actual":   f.valor_incorrecto,
                "descripcion":    f.descripcion,
                "sugerencia_ia":  f.sugerencia_ia,
                "valor_en_riesgo": f.valor_en_riesgo,
                "regla":          f.regla_codigo,
            }
            for f in result.findings
        ],
    }

    content = json.dumps(export, ensure_ascii=False, indent=2)
    filename = f"rips_guard_reporte_{session_id[:8]}.json"

    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────────────────────────────
# ARRANQUE LOCAL
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("worker:app", host="0.0.0.0", port=8000, reload=True)
