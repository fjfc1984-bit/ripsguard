"""
RIPS Guard — Parser RIPS Nueva Generación
Resolución 2275 de 2023 (Ministerio de Salud y Protección Social)

El RIPS Nueva Generación usa formato JSON estructurado adjunto a la
Factura Electrónica de Venta (FEV) emitida ante la DIAN.

Estructura principal:
  {
    "numDocumentoIdObligado": "NIT",
    "numFEV": "FEV-001",
    "tipoNota": null,
    "numNota": null,
    "usuarios": [ { ...servicios... } ]
  }
"""

import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from pathlib import Path
from typing import Any


# ─────────────────────────────────────────────
# TIPOS DE SECCIÓN RIPS (Res. 2275/2023)
# ─────────────────────────────────────────────

class SeccionRIPS(str, Enum):
    CONSULTAS       = "AC"   # serviciosConsultas
    PROCEDIMIENTOS  = "AP"   # serviciosProcedimientos
    URGENCIAS       = "AU"   # serviciosUrgencias
    HOSPITALIZACION = "AH"   # serviciosHospitalizacion
    RECIEN_NACIDOS  = "AN"   # serviciosRecienNacidos
    MEDICAMENTOS    = "AM"   # serviciosMedicamentos
    TRASLADO        = "AT"   # serviciosTransporte
    OTRAS           = "AD"   # otrasActividades


# Mapeo: clave JSON → SeccionRIPS
SECCION_MAP: dict[str, SeccionRIPS] = {
    "serviciosConsultas":        SeccionRIPS.CONSULTAS,
    "serviciosProcedimientos":   SeccionRIPS.PROCEDIMIENTOS,
    "serviciosUrgencias":        SeccionRIPS.URGENCIAS,
    "serviciosHospitalizacion":  SeccionRIPS.HOSPITALIZACION,
    "serviciosRecienNacidos":    SeccionRIPS.RECIEN_NACIDOS,
    "serviciosMedicamentos":     SeccionRIPS.MEDICAMENTOS,
    "serviciosTransporte":       SeccionRIPS.TRASLADO,
    "otrasActividades":          SeccionRIPS.OTRAS,
}

# ─────────────────────────────────────────────
# DATACLASSES DE SALIDA
# ─────────────────────────────────────────────

@dataclass
class UsuarioRIPS:
    """Datos del usuario (paciente) según RIPS 2275/2023."""
    tipo_doc_identificacion:  str
    num_doc_identificacion:   str
    tipo_usuario:             str   # 1=Contributivo, 2=Subsidiado, 3=Vinculado, etc.
    fecha_nacimiento:         str | None
    cod_sexo:                 str | None
    cod_pais_residencia:      str | None
    cod_municipio_residencia: str | None
    cod_zona_territorial:     str | None
    incapacidad:              str | None
    cod_pais_origen:          str | None
    # Registros de servicio agrupados por sección
    registros:                list["RegistroRIPS"] = field(default_factory=list)


@dataclass
class RegistroRIPS:
    """Un registro individual de servicio dentro de cualquier sección."""
    seccion:          SeccionRIPS
    numero_fila:      int
    datos:            dict[str, Any]   # Todos los campos originales
    # Campos normalizados (extraídos para validación rápida)
    codigo_cups:      str | None = None
    codigo_cie10:     str | None = None
    fecha_inicio:     str | None = None
    fecha_fin:        str | None = None
    valor_facturado:  float | None = None
    cantidad:         int | None = None


@dataclass
class RIPSDocument:
    """Documento RIPS completo parseado."""
    nit_prestador:  str
    num_fev:        str
    tipo_nota:      str | None
    num_nota:       str | None
    usuarios:       list[UsuarioRIPS]
    # Estadísticas rápidas
    total_usuarios:         int = 0
    total_registros:        int = 0
    registros_por_seccion:  dict[str, int] = field(default_factory=dict)
    valor_total_facturado:  float = 0.0
    errores_parse:          list[str] = field(default_factory=list)


# ─────────────────────────────────────────────
# PARSER
# ─────────────────────────────────────────────

class RIPSParser:
    """
    Parsea un archivo RIPS Nueva Generación (JSON) o un archivo ZIP
    que contiene el JSON adjunto a la FEV DIAN.

    Uso:
        parser = RIPSParser()
        doc = parser.parse_file("rips_ejemplo.json")
        print(doc.total_registros)
    """

    # Campos normalizados por sección para extracción rápida
    _CAMPOS_CUPS = {
        SeccionRIPS.CONSULTAS:       "codConsulta",
        SeccionRIPS.PROCEDIMIENTOS:  "codProcedimiento",
        SeccionRIPS.URGENCIAS:       "codConsulta",
        SeccionRIPS.HOSPITALIZACION: None,
        SeccionRIPS.MEDICAMENTOS:    None,
        SeccionRIPS.OTRAS:           "idMIPRES",
    }

    _CAMPOS_CIE10 = {
        SeccionRIPS.CONSULTAS:       "codDiagnosticoPrincipal",
        SeccionRIPS.PROCEDIMIENTOS:  "codDiagnosticoPrincipal",
        SeccionRIPS.URGENCIAS:       "codDiagnosticoPrincipal",
        SeccionRIPS.HOSPITALIZACION: "codDiagnosticoPrincipal",
    }

    _CAMPOS_VALOR = {
        SeccionRIPS.CONSULTAS:       "vrServicio",
        SeccionRIPS.PROCEDIMIENTOS:  "vrServicio",
        SeccionRIPS.URGENCIAS:       "vrServicio",
        SeccionRIPS.HOSPITALIZACION: "vrServicio",
        SeccionRIPS.MEDICAMENTOS:    "vrUnitMedicamento",
        SeccionRIPS.TRASLADO:        "vrServicio",
        SeccionRIPS.OTRAS:           "vrServicio",
    }

    def parse_file(self, path: str | Path) -> RIPSDocument:
        """Parsea un archivo JSON de RIPS desde disco."""
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {path}")

        suffix = path.suffix.lower()
        if suffix == ".json":
            raw = json.loads(path.read_text(encoding="utf-8"))
        elif suffix == ".zip":
            raw = self._extract_from_zip(path)
        else:
            raise ValueError(f"Formato no soportado: {suffix}. Use .json o .zip")

        return self._parse_raw(raw)

    def parse_string(self, content: str) -> RIPSDocument:
        """Parsea RIPS desde un string JSON (útil para uploads en memoria)."""
        raw = json.loads(content)
        return self._parse_raw(raw)

    # ── Internos ──────────────────────────────

    def _parse_raw(self, raw: dict) -> RIPSDocument:
        doc = RIPSDocument(
            nit_prestador=str(raw.get("numDocumentoIdObligado", "")),
            num_fev=str(raw.get("numFEV", "")),
            tipo_nota=raw.get("tipoNota"),
            num_nota=raw.get("numNota"),
            usuarios=[],
        )

        usuarios_raw = raw.get("usuarios", [])
        fila_global = 0

        for u_raw in usuarios_raw:
            usuario, registros, errores = self._parse_usuario(u_raw, fila_global)
            fila_global += len(registros)
            usuario.registros = registros
            doc.usuarios.append(usuario)
            doc.errores_parse.extend(errores)

        # Estadísticas
        doc.total_usuarios = len(doc.usuarios)
        doc.total_registros = sum(len(u.registros) for u in doc.usuarios)
        for usuario in doc.usuarios:
            for reg in usuario.registros:
                sec = reg.seccion.value
                doc.registros_por_seccion[sec] = doc.registros_por_seccion.get(sec, 0) + 1
                doc.valor_total_facturado += reg.valor_facturado or 0.0

        return doc

    def _parse_usuario(
        self, u: dict, fila_offset: int
    ) -> tuple[UsuarioRIPS, list[RegistroRIPS], list[str]]:
        usuario = UsuarioRIPS(
            tipo_doc_identificacion=u.get("tipoDocumentoIdentificacion", ""),
            num_doc_identificacion=u.get("numDocumentoIdentificacion", ""),
            tipo_usuario=u.get("tipoUsuario", ""),
            fecha_nacimiento=u.get("fechaNacimiento"),
            cod_sexo=u.get("codSexo"),
            cod_pais_residencia=u.get("codPaisResidencia"),
            cod_municipio_residencia=u.get("codMunicipioResidencia"),
            cod_zona_territorial=u.get("codZonaTerritorial"),
            incapacidad=u.get("incapacidad"),
            cod_pais_origen=u.get("codPaisOrigen"),
        )

        registros: list[RegistroRIPS] = []
        errores: list[str] = []
        fila = fila_offset

        for clave_json, seccion in SECCION_MAP.items():
            servicios = u.get(clave_json, [])
            if not isinstance(servicios, list):
                errores.append(f"Campo '{clave_json}' no es una lista en usuario {usuario.num_doc_identificacion}")
                continue

            for item in servicios:
                reg = self._parse_registro(item, seccion, fila)
                registros.append(reg)
                fila += 1

        return usuario, registros, errores

    def _parse_registro(self, item: dict, seccion: SeccionRIPS, fila: int) -> RegistroRIPS:
        cups_key  = self._CAMPOS_CUPS.get(seccion)
        cie10_key = self._CAMPOS_CIE10.get(seccion)
        valor_key = self._CAMPOS_VALOR.get(seccion)

        valor_raw = item.get(valor_key) if valor_key else None
        try:
            valor = float(valor_raw) if valor_raw is not None else None
        except (TypeError, ValueError):
            valor = None

        cantidad_raw = item.get("cantidadOS") or item.get("numDosis") or item.get("cantidad")
        try:
            cantidad = int(cantidad_raw) if cantidad_raw is not None else None
        except (TypeError, ValueError):
            cantidad = None

        return RegistroRIPS(
            seccion=seccion,
            numero_fila=fila,
            datos=item,
            codigo_cups=item.get(cups_key) if cups_key else None,
            codigo_cie10=item.get(cie10_key) if cie10_key else None,
            fecha_inicio=item.get("fechaInicioAtencion") or item.get("fechaConsulta"),
            fecha_fin=item.get("fechaFinalizacionAtencion"),
            valor_facturado=valor,
            cantidad=cantidad,
        )

    def _extract_from_zip(self, path: Path) -> dict:
        import zipfile
        with zipfile.ZipFile(path, "r") as z:
            json_files = [n for n in z.namelist() if n.lower().endswith(".json")]
            if not json_files:
                raise ValueError("El ZIP no contiene archivos JSON de RIPS")
            # Tomar el primer JSON que parezca RIPS (contiene 'usuarios')
            for name in json_files:
                content = z.read(name).decode("utf-8")
                try:
                    data = json.loads(content)
                    if "usuarios" in data:
                        return data
                except json.JSONDecodeError:
                    continue
            raise ValueError("No se encontró un JSON RIPS válido dentro del ZIP")


# ─────────────────────────────────────────────
# EJEMPLO DE RIPS PARA PRUEBAS
# ─────────────────────────────────────────────

RIPS_EJEMPLO = {
    "numDocumentoIdObligado": "900123456",
    "numFEV": "FEV-2024-001234",
    "tipoNota": None,
    "numNota": None,
    "usuarios": [
        {
            "tipoDocumentoIdentificacion": "CC",
            "numDocumentoIdentificacion": "1020304050",
            "tipoUsuario": "2",
            "fechaNacimiento": "1985-03-15",
            "codSexo": "M",
            "codPaisResidencia": "170",
            "codMunicipioResidencia": "11001",
            "codZonaTerritorial": "1",
            "incapacidad": "N",
            "codPaisOrigen": "170",
            "serviciosConsultas": [
                {
                    "codConsulta": "890201",           # CUPS válido (consulta médica general)
                    "modalidadGrupoServicioTecSal": "01",
                    "grupoServicios": "01",
                    "codServicio": "105",
                    "finalidadTecnologiaSalud": "11",
                    "causaMotivoAtencion": "27",
                    "fechaInicioAtencion": "2024-03-10",
                    "numAutorizacion": "AUTH-001",
                    "duracionConsulta": "30",
                    "codDiagnosticoPrincipal": "J06.9",  # CIE-10: IRA alta
                    "codDiagnosticosRelacionados": ["Z00.0"],
                    "tipoDiagnosticoPrincipal": "02",
                    "vrServicio": 45000,
                    "conceptoRecaudo": "02",
                    "valorPagoModerador": 5700,
                    "numFEVPrincipal": "FEV-2024-001234",
                }
            ],
            "serviciosProcedimientos": [
                {
                    "codProcedimiento": "903803",          # CUPS laboratorio
                    "fechaInicioAtencion": "2024-03-10",
                    "idMIPRES": None,
                    "numAutorizacion": "AUTH-002",
                    "modalidadGrupoServicioTecSal": "02",
                    "grupoServicios": "02",
                    "codServicio": "206",
                    "finalidadTecnologiaSalud": "13",
                    "tipoDocumentoIdentificacionMedico": "CC",
                    "numDocumentoIdentificacionMedico": "52801234",
                    "codDiagnosticoPrincipal": "XXXXX",   # ← CIE-10 INVÁLIDO (error intencional)
                    "codComplicacion": None,
                    "codDiagnosticosRelacionados": [],
                    "vrServicio": 0,                        # ← VALOR CERO (otro error)
                    "conceptoRecaudo": "02",
                    "valorPagoModerador": 0,
                }
            ],
            "serviciosMedicamentos": [
                {
                    "idMIPRES": None,
                    "fechaDispensAdmons": "2024-03-10",
                    "codDiagnosticoPrincipal": "J06.9",
                    "codDiagnosticosRelacionados": [],
                    "tipoMedicamento": "02",
                    "codTecnologiaSalud": "M01AE01",       # Ibuprofeno (ATC)
                    "nomTecnologiaSalud": "Ibuprofeno 400mg",
                    "concentracionMedicamento": "400",
                    "unidadMedidaMedicamento": "MG",
                    "formaFarmaceutica": "TAB",
                    "unidadMinDispensa": "UND",
                    "cantidadMedicamento": 20,
                    "diasTratamiento": 5,
                    "numAutorizacion": "AUTH-003",
                    "vrUnitMedicamento": 350,
                    "vrServicio": 7000,
                    "conceptoRecaudo": "02",
                    "valorPagoModerador": 0,
                }
            ],
            "serviciosUrgencias": [],
            "serviciosHospitalizacion": [],
            "serviciosRecienNacidos": [],
            "serviciosTransporte": [],
            "otrasActividades": [],
        }
    ],
}


if __name__ == "__main__":
    parser = RIPSParser()
    doc = parser.parse_string(json.dumps(RIPS_EJEMPLO))

    print(f"✅ RIPS parseado correctamente")
    print(f"   NIT Prestador  : {doc.nit_prestador}")
    print(f"   FEV            : {doc.num_fev}")
    print(f"   Usuarios       : {doc.total_usuarios}")
    print(f"   Total registros: {doc.total_registros}")
    print(f"   Valor facturado: ${doc.valor_total_facturado:,.0f} COP")
    print(f"   Por sección    : {doc.registros_por_seccion}")
    if doc.errores_parse:
        print(f"   ⚠️  Errores de parse: {doc.errores_parse}")
