"""
RIPS Guard — FastAPI Worker
Orquestador del pipeline: Upload → Parse → Validate → AI Correct → Persist → Report

Endpoints:
  POST /audit/upload          → Sube archivo e inicia auditoría (async)
  GET  /audit/{session_id}    → Estado de la sesión
  GET  /audit/{session_id}/report → Resultado completo con findings y correcciones
  GET  /audit/{session_id}/download → Archivo RIPS corregido para descargar

Deploy: Cloudflare Workers / Railway / Render (Python 3.11+)
"""

from __future__ import annotations

import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from rips_parser import RIPSParser
from validation_engine import ValidationEngine, AuditResult, Severidad
from ai_corrector import AICorrector, merge_corrections_into_findings


# ─────────────────────────────────────────────
# MODELOS DE RESPUESTA (Pydantic)
# ─────────────────────────────────────────────

class SessionStatus(BaseModel):
    session_id:     str
    estado:         str
    nombre_archivo: str
    created_at:     str
    procesado_at:   str | None
    total_registros: int
    total_errores:  int
    total_criticos: int
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
    session_id:         str
    tenant_id:          str
    total_registros:    int
    total_errores:      int
    total_criticos:     int
    total_advertencias: int
    valor_total:        float
    valor_en_riesgo:    float
    porcentaje_riesgo:  float
    findings:           list[FindingResponse]
    resumen_por_seccion: dict[str, Any]
    resumen_por_tipo_error: dict[str, int]


# ─────────────────────────────────────────────
# ALMACENAMIENTO EN MEMORIA (MVP)
# En producción: reemplazar con Supabase client
# ─────────────────────────────────────────────

_sessions: dict[str, dict] = {}   # session_id → sesión completa


# ─────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────

app = FastAPI(
    title="RIPS Guard API",
    description="Auditoría y corrección de archivos RIPS/Facturación Electrónica",
    version="0.1.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # En producción: solo tu dominio Next.js
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instanciar servicios (singletons)
parser    = RIPSParser()
engine    = ValidationEngine()
corrector = AICorrector(model="claude-haiku-4-5-20251001")


# ─────────────────────────────────────────────
# DEPENDENCIAS
# ─────────────────────────────────────────────

def get_tenant_id(x_tenant_id: str = Header(...)) -> str:
    """
    Extrae el tenant_id del header de la request.
    En producción: validar contra Supabase JWT.
    """
    if not x_tenant_id:
        raise HTTPException(status_code=401, detail="Header X-Tenant-Id requerido")
    return x_tenant_id


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.post("/audit/upload", response_model=SessionStatus, status_code=202)
async def upload_rips(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Recibe un archivo RIPS JSON o ZIP, lo audita en background y retorna
    el session_id para consultar el resultado.

    En el MVP procesa sincrónicamente (< 2s para archivos típicos).
    En producción: encolar con Supabase Realtime / BullMQ.
    """
    # Validar tipo de archivo
    allowed = {".json", ".zip"}
    suffix  = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if suffix not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado '{suffix}'. Use .json o .zip"
        )

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:   # 50 MB máximo
        raise HTTPException(status_code=413, detail="Archivo demasiado grande. Máximo 50 MB.")

    session_id  = str(uuid.uuid4())
    created_at  = datetime.utcnow().isoformat()

    # Iniciar sesión en estado pending
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
            import tempfile, pathlib
            with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            doc = parser.parse_file(tmp_path)
        else:
            doc = parser.parse_string(content.decode("utf-8"))

        # 2. VALIDATE
        result = engine.validate(doc)

        # 3. AI CORRECTIONS (solo para errores críticos y advertencias de CIE10/CUPS)
        registros_map = {
            reg.numero_fila: reg
            for usuario in doc.usuarios
            for reg in usuario.registros
        }
        if os.environ.get("ANTHROPIC_API_KEY"):
            corrections = corrector.correct_batch(result.findings, registros_map)
            result.findings = merge_corrections_into_findings(result.findings, corrections)

        # 4. PERSIST (en producción: Supabase insert)
        _sessions[session_id].update({
            "estado":           "completado",
            "procesado_at":     datetime.utcnow().isoformat(),
            "total_registros":  result.total_registros,
            "total_errores":    result.total_errores,
            "total_criticos":   result.total_criticos,
            "valor_en_riesgo":  result.valor_en_riesgo,
            "result":           result,
        })

    except Exception as exc:
        _sessions[session_id].update({
            "estado": "error",
            "error":  str(exc),
            "total_registros": 0,
            "total_errores": 0,
            "total_criticos": 0,
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


@app.get("/audit/{session_id}", response_model=SessionStatus)
async def get_session(
    session_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    sess = _sessions.get(session_id)
    if not sess or sess["tenant_id"] != tenant_id:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

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


@app.get("/audit/{session_id}/report", response_model=AuditReportResponse)
async def get_report(
    session_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    sess = _sessions.get(session_id)
    if not sess or sess["tenant_id"] != tenant_id:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if sess["estado"] != "completado":
        raise HTTPException(status_code=409, detail=f"Sesión en estado '{sess['estado']}'. Espere a que complete.")

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


@app.get("/audit/{session_id}/download")
async def download_corrected(
    session_id: str,
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Descarga el reporte de errores en JSON (MVP).
    En producción: generar XLSX/PDF con archivo RIPS corregido.
    """
    sess = _sessions.get(session_id)
    if not sess or sess["tenant_id"] != tenant_id:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if sess["estado"] != "completado":
        raise HTTPException(status_code=409, detail="Sesión aún no completada")

    result: AuditResult = sess["result"]
    export = {
        "session_id":       session_id,
        "nombre_archivo":   sess["nombre_archivo"],
        "fecha_auditoria":  sess["procesado_at"],
        "resumen": {
            "total_registros":    result.total_registros,
            "total_errores":      result.total_errores,
            "criticos":           result.total_criticos,
            "advertencias":       result.total_advertencias,
            "valor_total_cop":    result.valor_total,
            "valor_en_riesgo_cop": result.valor_en_riesgo,
            "porcentaje_riesgo":  result.porcentaje_riesgo,
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
