"""
RIPS Guard — Motor de Validación
Valida registros RIPS contra las reglas de habilitación y codificación.

Fuentes normativas:
  - Resolución 2275 de 2023 (RIPS Nueva Generación)
  - Manual CUPS vigente (Res. 2192 de 2023)
  - CIE-10 versión MSPS Colombia
  - Manual tarifario ISS 2001 (referencia contratos)
  - Resolución 3512 de 2019 (medicamentos SOAT)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Callable

from rips_parser import RegistroRIPS, RIPSDocument, SeccionRIPS, UsuarioRIPS


# ─────────────────────────────────────────────
# TIPOS DE ERROR Y SEVERIDAD
# ─────────────────────────────────────────────

class TipoError(str, Enum):
    CUPS_INVALIDO                    = "cups_invalido"
    CUPS_NO_CONTRATADO               = "cups_no_contratado"
    CIE10_INVALIDO                   = "cie10_invalido"
    CIE10_INCOMPATIBLE_PROCEDIMIENTO = "cie10_incompatible_procedimiento"
    CAMPO_VACIO                      = "campo_vacio"
    CAMPO_FORMATO_INVALIDO           = "campo_formato_invalido"
    TARIFA_FUERA_RANGO               = "tarifa_fuera_rango"
    VALOR_CERO_NO_PERMITIDO          = "valor_cero_no_permitido"
    DUPLICADO_REGISTRO               = "duplicado_registro"
    FECHA_INVALIDA                   = "fecha_invalida"
    FECHA_FUTURA                     = "fecha_futura"
    DOCUMENTO_USUARIO_INVALIDO       = "documento_usuario_invalido"
    TIPO_USUARIO_INCONSISTENTE       = "tipo_usuario_inconsistente"
    CANTIDAD_INVALIDA                = "cantidad_invalida"


class Severidad(str, Enum):
    CRITICO     = "critico"      # Garantiza glosa — debe corregirse
    ADVERTENCIA = "advertencia"  # Probable glosa — revisar
    INFO        = "info"         # Recomendación — puede no glosar


# ─────────────────────────────────────────────
# HALLAZGO DE VALIDACIÓN
# ─────────────────────────────────────────────

@dataclass
class Finding:
    tipo_error:       TipoError
    severidad:        Severidad
    campo:            str
    valor_incorrecto: str | None
    descripcion:      str
    seccion:          SeccionRIPS
    numero_fila:      int
    valor_en_riesgo:  float = 0.0    # COP que puede glosarse
    regla_codigo:     str = ""
    sugerencia_ia:    str | None = None   # Llenado después por AI Corrector


@dataclass
class AuditResult:
    """Resultado completo de una sesión de auditoría."""
    total_registros:    int
    total_errores:      int
    total_criticos:     int
    total_advertencias: int
    total_info:         int
    valor_total:        float
    valor_en_riesgo:    float
    porcentaje_riesgo:  float
    findings:           list[Finding]
    resumen_por_seccion: dict[str, dict]
    resumen_por_tipo_error: dict[str, int]


# ─────────────────────────────────────────────
# CATÁLOGO DE REFERENCIA (Simplificado para MVP)
# En producción: cargado desde BD (tabla reference_db)
# ─────────────────────────────────────────────

# Subconjunto de CUPS válidos para demo — en producción son ~15.000 códigos
CUPS_VALIDOS: set[str] = {
    # Consultas
    "890201", "890202", "890203", "890205", "890206", "890208",
    "890301", "890302", "890303",
    # Laboratorio
    "903803", "903806", "903826", "903832", "903850",
    # Radiología
    "872101", "872102", "872103", "872104",
    # Cirugía
    "471501", "471502", "471503",
    # Urgencias
    "890201",
}

# Subconjunto CIE-10 válidos — en producción son ~14.000 códigos
CIE10_VALIDOS: set[str] = {
    "J00", "J06.9", "J18.9", "J45.9", "K29.7", "K35.9",
    "Z00.0", "Z00.1", "Z34.0", "I10", "E11.9", "E14.9",
    "A09", "B34.9", "F32.9", "M54.5", "N39.0", "R10.4",
    "S00.9", "T14.9", "Z23",
}

# Incompatibilidades conocidas CUPS ↔ CIE-10 (ejemplos)
# En producción: tabla cups_cie10_incompatibilidades en BD
CUPS_CIE10_INCOMPATIBLES: dict[str, set[str]] = {
    "890201": {"Z34.0"},   # Consulta médica general NO puede tener Dx embarazo como principal (va a ginecoobstetricia)
    "471501": {"J00"},     # Cirugía mayor no compatible con resfriado común como Dx principal
}

# Rangos de valores aceptables por CUPS (ISS 2001 de referencia, en COP)
# En producción: tabla tarifas_referencia con vigencia y EPS
CUPS_VALOR_RANGO: dict[str, tuple[float, float]] = {
    "890201": (30_000, 120_000),    # Consulta médica general
    "890202": (40_000, 150_000),    # Consulta médica especializada
    "903803": (8_000, 45_000),      # Hemograma completo
    "903806": (5_000, 30_000),      # Glicemia
    "872101": (50_000, 200_000),    # Radiografía tórax
}

# Tipos de documento válidos en Colombia
TIPOS_DOC_VALIDOS: set[str] = {
    "CC",   # Cédula de ciudadanía
    "TI",   # Tarjeta de identidad
    "RC",   # Registro civil
    "CE",   # Cédula de extranjería
    "PA",   # Pasaporte
    "MS",   # Menor sin identificación
    "AS",   # Adulto sin identificación
    "PE",   # Permiso especial de permanencia
    "PT",   # Permiso por protección temporal
    "NIT",  # NIT (para empresas)
    "CD",   # Carné diplomático
}

# Formatos de fecha aceptados
FORMATO_FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# ─────────────────────────────────────────────
# MOTOR DE VALIDACIÓN
# ─────────────────────────────────────────────

class ValidationEngine:
    """
    Aplica todas las reglas de validación sobre un RIPSDocument.

    Uso:
        engine = ValidationEngine()
        result = engine.validate(doc)
        print(f"Errores críticos: {result.total_criticos}")
        print(f"Valor en riesgo: ${result.valor_en_riesgo:,.0f} COP")
    """

    def __init__(
        self,
        cups_validos: set[str] | None = None,
        cie10_validos: set[str] | None = None,
        cups_valor_rango: dict[str, tuple[float, float]] | None = None,
    ):
        # En producción se inyectan desde BD; aquí usamos el demo
        self._cups       = cups_validos or CUPS_VALIDOS
        self._cie10      = cie10_validos or CIE10_VALIDOS
        self._rangos     = cups_valor_rango or CUPS_VALOR_RANGO
        self._seen_keys: set[str] = set()   # Para detección de duplicados

    # ── Punto de entrada ──────────────────────

    def validate(self, doc: RIPSDocument) -> AuditResult:
        findings: list[Finding] = []
        self._seen_keys.clear()

        for usuario in doc.usuarios:
            # Validar datos del usuario
            findings.extend(self._validate_usuario(usuario))
            # Validar cada registro de servicio
            for reg in usuario.registros:
                findings.extend(self._validate_registro(reg, usuario))

        return self._build_result(doc, findings)

    # ── Validaciones de usuario ───────────────

    def _validate_usuario(self, u: UsuarioRIPS) -> list[Finding]:
        errs: list[Finding] = []

        # R-USR-001: Tipo de documento válido
        if u.tipo_doc_identificacion not in TIPOS_DOC_VALIDOS:
            errs.append(Finding(
                tipo_error=TipoError.DOCUMENTO_USUARIO_INVALIDO,
                severidad=Severidad.CRITICO,
                campo="tipoDocumentoIdentificacion",
                valor_incorrecto=u.tipo_doc_identificacion,
                descripcion=f"Tipo de documento '{u.tipo_doc_identificacion}' no reconocido por MSPS. "
                            f"Valores válidos: {', '.join(sorted(TIPOS_DOC_VALIDOS))}",
                seccion=SeccionRIPS.CONSULTAS,
                numero_fila=-1,
                regla_codigo="R-USR-001",
            ))

        # R-USR-002: Número de documento no vacío
        if not u.num_doc_identificacion or len(u.num_doc_identificacion.strip()) < 5:
            errs.append(Finding(
                tipo_error=TipoError.CAMPO_VACIO,
                severidad=Severidad.CRITICO,
                campo="numDocumentoIdentificacion",
                valor_incorrecto=u.num_doc_identificacion,
                descripcion="Número de documento de identificación vacío o inválido (mínimo 5 caracteres).",
                seccion=SeccionRIPS.CONSULTAS,
                numero_fila=-1,
                regla_codigo="R-USR-002",
            ))

        # R-USR-003: Fecha de nacimiento con formato válido
        if u.fecha_nacimiento and not FORMATO_FECHA.match(u.fecha_nacimiento):
            errs.append(Finding(
                tipo_error=TipoError.FECHA_INVALIDA,
                severidad=Severidad.ADVERTENCIA,
                campo="fechaNacimiento",
                valor_incorrecto=u.fecha_nacimiento,
                descripcion=f"Fecha de nacimiento '{u.fecha_nacimiento}' no tiene formato YYYY-MM-DD.",
                seccion=SeccionRIPS.CONSULTAS,
                numero_fila=-1,
                regla_codigo="R-USR-003",
            ))

        return errs

    # ── Validaciones por registro ─────────────

    def _validate_registro(self, reg: RegistroRIPS, usuario: UsuarioRIPS) -> list[Finding]:
        errs: list[Finding] = []

        errs.extend(self._check_cups(reg))
        errs.extend(self._check_cie10(reg))
        errs.extend(self._check_cups_cie10_compatibilidad(reg))
        errs.extend(self._check_valor(reg))
        errs.extend(self._check_fecha(reg))
        errs.extend(self._check_duplicado(reg, usuario))
        errs.extend(self._check_campos_obligatorios(reg))

        return errs

    # ── Reglas individuales ───────────────────

    def _check_cups(self, reg: RegistroRIPS) -> list[Finding]:
        errs = []
        secciones_con_cups = {
            SeccionRIPS.CONSULTAS,
            SeccionRIPS.PROCEDIMIENTOS,
            SeccionRIPS.URGENCIAS,
        }
        if reg.seccion not in secciones_con_cups:
            return errs

        if not reg.codigo_cups:
            errs.append(Finding(
                tipo_error=TipoError.CAMPO_VACIO,
                severidad=Severidad.CRITICO,
                campo="codConsulta / codProcedimiento",
                valor_incorrecto=None,
                descripcion="Código CUPS ausente. Es obligatorio en todas las secciones de servicio.",
                seccion=reg.seccion,
                numero_fila=reg.numero_fila,
                valor_en_riesgo=reg.valor_facturado or 0,
                regla_codigo="R-CUPS-001",
            ))
        elif reg.codigo_cups not in self._cups:
            errs.append(Finding(
                tipo_error=TipoError.CUPS_INVALIDO,
                severidad=Severidad.CRITICO,
                campo="codConsulta / codProcedimiento",
                valor_incorrecto=reg.codigo_cups,
                descripcion=f"Código CUPS '{reg.codigo_cups}' no existe en el Manual CUPS vigente "
                            f"(Res. 2192 de 2023). Verifique o consulte el catálogo MSPS.",
                seccion=reg.seccion,
                numero_fila=reg.numero_fila,
                valor_en_riesgo=reg.valor_facturado or 0,
                regla_codigo="R-CUPS-002",
            ))
        return errs

    def _check_cie10(self, reg: RegistroRIPS) -> list[Finding]:
        errs = []
        if not reg.codigo_cie10:
            if reg.seccion in {SeccionRIPS.CONSULTAS, SeccionRIPS.PROCEDIMIENTOS, SeccionRIPS.URGENCIAS}:
                errs.append(Finding(
                    tipo_error=TipoError.CAMPO_VACIO,
                    severidad=Severidad.CRITICO,
                    campo="codDiagnosticoPrincipal",
                    valor_incorrecto=None,
                    descripcion="Diagnóstico principal CIE-10 ausente. Obligatorio en consultas y procedimientos.",
                    seccion=reg.seccion,
                    numero_fila=reg.numero_fila,
                    valor_en_riesgo=reg.valor_facturado or 0,
                    regla_codigo="R-CIE10-001",
                ))
            return errs

        # Normalizar: quitar espacios, mayúsculas
        cie10 = reg.codigo_cie10.strip().upper()

        if cie10 not in self._cie10:
            errs.append(Finding(
                tipo_error=TipoError.CIE10_INVALIDO,
                severidad=Severidad.CRITICO,
                campo="codDiagnosticoPrincipal",
                valor_incorrecto=reg.codigo_cie10,
                descripcion=f"Código CIE-10 '{reg.codigo_cie10}' no existe en la clasificación vigente. "
                            f"Verifique subcategoría o use el código padre.",
                seccion=reg.seccion,
                numero_fila=reg.numero_fila,
                valor_en_riesgo=reg.valor_facturado or 0,
                regla_codigo="R-CIE10-002",
            ))
        return errs

    def _check_cups_cie10_compatibilidad(self, reg: RegistroRIPS) -> list[Finding]:
        errs = []
        if not reg.codigo_cups or not reg.codigo_cie10:
            return errs

        incompatibles = CUPS_CIE10_INCOMPATIBLES.get(reg.codigo_cups, set())
        if reg.codigo_cie10 in incompatibles:
            errs.append(Finding(
                tipo_error=TipoError.CIE10_INCOMPATIBLE_PROCEDIMIENTO,
                severidad=Severidad.ADVERTENCIA,
                campo="codDiagnosticoPrincipal",
                valor_incorrecto=reg.codigo_cie10,
                descripcion=f"El diagnóstico '{reg.codigo_cie10}' no es compatible con el CUPS '{reg.codigo_cups}'. "
                            f"Las EPS frecuentemente glosan esta combinación. Revise el diagnóstico o el código del servicio.",
                seccion=reg.seccion,
                numero_fila=reg.numero_fila,
                valor_en_riesgo=(reg.valor_facturado or 0) * 0.5,  # Riesgo parcial
                regla_codigo="R-COMPAT-001",
            ))
        return errs

    def _check_valor(self, reg: RegistroRIPS) -> list[Finding]:
        errs = []

        # R-VAL-001: Valor cero en servicios que deben tener valor
        secciones_con_valor = {
            SeccionRIPS.CONSULTAS,
            SeccionRIPS.PROCEDIMIENTOS,
            SeccionRIPS.URGENCIAS,
            SeccionRIPS.HOSPITALIZACION,
        }
        if reg.seccion in secciones_con_valor:
            if reg.valor_facturado is None or reg.valor_facturado == 0:
                errs.append(Finding(
                    tipo_error=TipoError.VALOR_CERO_NO_PERMITIDO,
                    severidad=Severidad.CRITICO,
                    campo="vrServicio",
                    valor_incorrecto=str(reg.valor_facturado),
                    descripcion="Valor del servicio es cero o nulo. Las EPS rechazan registros sin valor facturado "
                                "en servicios de consulta, procedimiento, urgencias u hospitalización.",
                    seccion=reg.seccion,
                    numero_fila=reg.numero_fila,
                    regla_codigo="R-VAL-001",
                ))
                return errs

        # R-VAL-002: Valor fuera del rango de referencia
        if reg.codigo_cups and reg.valor_facturado:
            rango = self._rangos.get(reg.codigo_cups)
            if rango:
                vmin, vmax = rango
                if not (vmin <= reg.valor_facturado <= vmax):
                    errs.append(Finding(
                        tipo_error=TipoError.TARIFA_FUERA_RANGO,
                        severidad=Severidad.ADVERTENCIA,
                        campo="vrServicio",
                        valor_incorrecto=str(reg.valor_facturado),
                        descripcion=f"Valor ${reg.valor_facturado:,.0f} COP fuera del rango esperado "
                                    f"(${vmin:,.0f} – ${vmax:,.0f} COP) para CUPS {reg.codigo_cups}. "
                                    f"Puede generar glosa por sobrefacturación o subfacturación.",
                        seccion=reg.seccion,
                        numero_fila=reg.numero_fila,
                        valor_en_riesgo=reg.valor_facturado,
                        regla_codigo="R-VAL-002",
                    ))
        return errs

    def _check_fecha(self, reg: RegistroRIPS) -> list[Finding]:
        errs = []
        for campo_fecha in ("fecha_inicio", "fecha_fin"):
            valor = getattr(reg, campo_fecha, None)
            if not valor:
                continue

            if not FORMATO_FECHA.match(valor):
                errs.append(Finding(
                    tipo_error=TipoError.FECHA_INVALIDA,
                    severidad=Severidad.CRITICO,
                    campo=campo_fecha,
                    valor_incorrecto=valor,
                    descripcion=f"Fecha '{valor}' no tiene el formato requerido YYYY-MM-DD.",
                    seccion=reg.seccion,
                    numero_fila=reg.numero_fila,
                    regla_codigo="R-FECHA-001",
                ))
                continue

            # R-FECHA-002: Fecha futura
            try:
                fecha = date.fromisoformat(valor)
                if fecha > date.today():
                    errs.append(Finding(
                        tipo_error=TipoError.FECHA_FUTURA,
                        severidad=Severidad.ADVERTENCIA,
                        campo=campo_fecha,
                        valor_incorrecto=valor,
                        descripcion=f"Fecha de atención '{valor}' es futura. Las EPS rechazan fechas posteriores a hoy.",
                        seccion=reg.seccion,
                        numero_fila=reg.numero_fila,
                        regla_codigo="R-FECHA-002",
                    ))
            except ValueError:
                errs.append(Finding(
                    tipo_error=TipoError.FECHA_INVALIDA,
                    severidad=Severidad.CRITICO,
                    campo=campo_fecha,
                    valor_incorrecto=valor,
                    descripcion=f"Fecha '{valor}' tiene formato correcto pero valor inválido (ej: mes 13, día 32).",
                    seccion=reg.seccion,
                    numero_fila=reg.numero_fila,
                    regla_codigo="R-FECHA-003",
                ))
        return errs

    def _check_duplicado(self, reg: RegistroRIPS, usuario: UsuarioRIPS) -> list[Finding]:
        errs = []
        # Clave única: usuario + sección + CUPS + fecha + valor
        key = (
            usuario.num_doc_identificacion,
            reg.seccion.value,
            reg.codigo_cups or "",
            reg.fecha_inicio or "",
            str(reg.valor_facturado or 0),
        )
        key_str = "|".join(key)
        if key_str in self._seen_keys:
            errs.append(Finding(
                tipo_error=TipoError.DUPLICADO_REGISTRO,
                severidad=Severidad.CRITICO,
                campo="registro_completo",
                valor_incorrecto=key_str,
                descripcion=f"Registro duplicado detectado: mismo usuario, CUPS, fecha y valor ya existe "
                            f"en la sesión. Las EPS glosan todos los duplicados.",
                seccion=reg.seccion,
                numero_fila=reg.numero_fila,
                valor_en_riesgo=reg.valor_facturado or 0,
                regla_codigo="R-DUP-001",
            ))
        else:
            self._seen_keys.add(key_str)
        return errs

    def _check_campos_obligatorios(self, reg: RegistroRIPS) -> list[Finding]:
        """Verifica campos obligatorios según sección (Res. 2275/2023, Anexo Técnico)."""
        errs = []

        obligatorios_por_seccion: dict[SeccionRIPS, list[str]] = {
            SeccionRIPS.CONSULTAS: [
                "modalidadGrupoServicioTecSal", "grupoServicios", "codServicio",
                "finalidadTecnologiaSalud", "causaMotivoAtencion",
            ],
            SeccionRIPS.PROCEDIMIENTOS: [
                "modalidadGrupoServicioTecSal", "grupoServicios", "codServicio",
                "finalidadTecnologiaSalud",
                "tipoDocumentoIdentificacionMedico", "numDocumentoIdentificacionMedico",
            ],
            SeccionRIPS.MEDICAMENTOS: [
                "tipoMedicamento", "codTecnologiaSalud", "nomTecnologiaSalud",
                "formaFarmaceutica", "cantidadMedicamento", "diasTratamiento",
            ],
        }

        campos = obligatorios_por_seccion.get(reg.seccion, [])
        for campo in campos:
            if not reg.datos.get(campo):
                errs.append(Finding(
                    tipo_error=TipoError.CAMPO_VACIO,
                    severidad=Severidad.ADVERTENCIA,
                    campo=campo,
                    valor_incorrecto=None,
                    descripcion=f"Campo obligatorio '{campo}' está vacío o ausente en sección {reg.seccion.value} "
                                f"(Res. 2275/2023, Anexo Técnico).",
                    seccion=reg.seccion,
                    numero_fila=reg.numero_fila,
                    regla_codigo="R-CAMP-001",
                ))
        return errs

    # ── Consolidar resultado ──────────────────

    def _build_result(self, doc: RIPSDocument, findings: list[Finding]) -> AuditResult:
        criticos     = [f for f in findings if f.severidad == Severidad.CRITICO]
        advertencias = [f for f in findings if f.severidad == Severidad.ADVERTENCIA]
        info_        = [f for f in findings if f.severidad == Severidad.INFO]

        valor_en_riesgo = sum(f.valor_en_riesgo for f in findings)

        resumen_por_tipo: dict[str, int] = {}
        for f in findings:
            resumen_por_tipo[f.tipo_error.value] = resumen_por_tipo.get(f.tipo_error.value, 0) + 1

        resumen_por_seccion: dict[str, dict] = {}
        for f in findings:
            sec = f.seccion.value
            if sec not in resumen_por_seccion:
                resumen_por_seccion[sec] = {"criticos": 0, "advertencias": 0, "valor_en_riesgo": 0}
            if f.severidad == Severidad.CRITICO:
                resumen_por_seccion[sec]["criticos"] += 1
            elif f.severidad == Severidad.ADVERTENCIA:
                resumen_por_seccion[sec]["advertencias"] += 1
            resumen_por_seccion[sec]["valor_en_riesgo"] += f.valor_en_riesgo

        pct_riesgo = (valor_en_riesgo / doc.valor_total_facturado * 100) if doc.valor_total_facturado else 0

        return AuditResult(
            total_registros=doc.total_registros,
            total_errores=len(findings),
            total_criticos=len(criticos),
            total_advertencias=len(advertencias),
            total_info=len(info_),
            valor_total=doc.valor_total_facturado,
            valor_en_riesgo=valor_en_riesgo,
            porcentaje_riesgo=round(pct_riesgo, 2),
            findings=findings,
            resumen_por_seccion=resumen_por_seccion,
            resumen_por_tipo_error=resumen_por_tipo,
        )


# ─────────────────────────────────────────────
# DEMO
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import json
    from rips_parser import RIPSParser, RIPS_EJEMPLO

    parser = RIPSParser()
    doc    = parser.parse_string(json.dumps(RIPS_EJEMPLO))

    engine = ValidationEngine()
    result = engine.validate(doc)

    print("\n" + "="*60)
    print("  RIPS Guard — Resultado de Auditoría")
    print("="*60)
    print(f"  Registros auditados : {result.total_registros}")
    print(f"  Total errores       : {result.total_errores}")
    print(f"  ❌ Críticos         : {result.total_criticos}")
    print(f"  ⚠️  Advertencias     : {result.total_advertencias}")
    print(f"  💰 Valor facturado  : ${result.valor_total:,.0f} COP")
    print(f"  🔴 Valor en riesgo  : ${result.valor_en_riesgo:,.0f} COP ({result.porcentaje_riesgo:.1f}%)")
    print("\n  Errores encontrados:")
    print("-"*60)
    for f in result.findings:
        icon = "❌" if f.severidad == Severidad.CRITICO else "⚠️ "
        print(f"  {icon} [{f.regla_codigo}] Fila {f.numero_fila} | {f.campo}")
        print(f"     → {f.descripcion[:80]}...")
        if f.valor_en_riesgo:
            print(f"     💰 En riesgo: ${f.valor_en_riesgo:,.0f} COP")
    print("="*60)
