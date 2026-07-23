"""
RIPS Guard — AI Corrector
Usa la API de Anthropic (Claude) para sugerir correcciones semánticas
sobre los findings encontrados por el motor de validación.

Casos de uso principales:
  1. CIE-10 inválido → sugerir el código correcto basado en el contexto clínico
  2. CUPS inválido → sugerir el código que más se aproxima al servicio prestado
  3. Incompatibilidad CUPS ↔ CIE-10 → sugerir diagnóstico alternativo

Requiere: ANTHROPIC_API_KEY en variables de entorno
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

import anthropic

from rips_parser import RegistroRIPS, SeccionRIPS
from validation_engine import Finding, Severidad, TipoError


# ─────────────────────────────────────────────
# RESULTADO DE CORRECCIÓN IA
# ─────────────────────────────────────────────

@dataclass
class AICorrection:
    finding_id:       str          # Identificador del finding (numero_fila + campo)
    valor_sugerido:   str          # Código o valor corregido
    justificacion:    str          # Explicación clínica / normativa
    confianza:        float        # 0.0 – 1.0
    origen:           str = "ia"
    alternativas:     list[str] = None  # Otros códigos posibles


# ─────────────────────────────────────────────
# AI CORRECTOR
# ─────────────────────────────────────────────

class AICorrector:
    """
    Genera sugerencias de corrección usando Claude (claude-haiku-4-5 para bajo costo,
    claude-sonnet-5 para mayor precisión clínica).

    Uso:
        corrector = AICorrector(model="claude-haiku-4-5-20251001")
        corrections = corrector.correct_batch(findings, registros)
    """

    # Tipos de error que la IA puede corregir semánticamente
    TIPOS_CORREGIBLES = {
        TipoError.CIE10_INVALIDO,
        TipoError.CIE10_INCOMPATIBLE_PROCEDIMIENTO,
        TipoError.CUPS_INVALIDO,
    }

    def __init__(
        self,
        model: str = "claude-haiku-4-5-20251001",
        max_tokens: int = 1024,
        api_key: str | None = None,
    ):
        self.model      = model
        self.max_tokens = max_tokens
        self._client    = anthropic.Anthropic(
            api_key=api_key or os.environ.get("ANTHROPIC_API_KEY")
        )

    # ── Punto de entrada ──────────────────────

    def correct_batch(
        self,
        findings: list[Finding],
        registros_map: dict[int, RegistroRIPS],   # numero_fila → RegistroRIPS
    ) -> list[AICorrection]:
        """
        Procesa todos los findings corregibles.
        Agrupa los de un mismo registro para una sola llamada a la API.
        """
        # Filtrar solo los que la IA puede resolver
        corregibles = [f for f in findings if f.tipo_error in self.TIPOS_CORREGIBLES]
        if not corregibles:
            return []

        # Agrupar por fila para minimizar llamadas API
        por_fila: dict[int, list[Finding]] = {}
        for f in corregibles:
            por_fila.setdefault(f.numero_fila, []).append(f)

        corrections: list[AICorrection] = []
        for fila, fila_findings in por_fila.items():
            reg = registros_map.get(fila)
            if reg is None:
                continue
            batch_corrections = self._correct_registro(fila_findings, reg)
            corrections.extend(batch_corrections)

        return corrections

    # ── Corrección de un registro ─────────────

    def _correct_registro(
        self, findings: list[Finding], reg: RegistroRIPS
    ) -> list[AICorrection]:
        prompt = self._build_prompt(findings, reg)

        try:
            message = self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=self._system_prompt(),
                messages=[{"role": "user", "content": prompt}],
            )
            response_text = message.content[0].text
            return self._parse_response(response_text, findings)

        except Exception as e:
            # No bloquear el flujo si la IA falla — el reporte igual se genera
            print(f"[AICorrector] Error en llamada API fila {reg.numero_fila}: {e}")
            return []

    # ── Construcción del prompt ───────────────

    def _system_prompt(self) -> str:
        return """Eres un auditor médico experto en codificación clínica colombiana.
Tu especialidad es el sistema RIPS (Resolución 2275 de 2023), el Manual CUPS vigente
(Resolución 2192 de 2023) y la Clasificación Internacional de Enfermedades CIE-10
versión MSPS Colombia.

Cuando te presenten errores de codificación en archivos RIPS, debes:
1. Analizar el contexto clínico del registro
2. Sugerir el código correcto basándote en la normativa colombiana vigente
3. Dar una justificación clínica y normativa concisa
4. Estimar tu nivel de confianza (0.0 a 1.0)

IMPORTANTE: Responde SIEMPRE en formato JSON válido. Sin texto antes ni después del JSON.
"""

    def _build_prompt(self, findings: list[Finding], reg: RegistroRIPS) -> str:
        contexto = {
            "seccion": reg.seccion.value,
            "numero_fila": reg.numero_fila,
            "codigo_cups_actual": reg.codigo_cups,
            "codigo_cie10_actual": reg.codigo_cie10,
            "valor_facturado": reg.valor_facturado,
            "fecha_servicio": reg.fecha_inicio,
            "datos_adicionales": {k: v for k, v in (reg.datos or {}).items()
                                  if k not in ("codConsulta", "codProcedimiento", "codDiagnosticoPrincipal")
                                  and v is not None},
        }

        errores = [
            {
                "tipo": f.tipo_error.value,
                "campo": f.campo,
                "valor_incorrecto": f.valor_incorrecto,
                "descripcion": f.descripcion,
            }
            for f in findings
        ]

        return f"""Analiza este registro RIPS con errores de codificación y sugiere correcciones:

CONTEXTO DEL REGISTRO:
{json.dumps(contexto, ensure_ascii=False, indent=2)}

ERRORES DETECTADOS:
{json.dumps(errores, ensure_ascii=False, indent=2)}

Responde con este JSON exacto:
{{
  "correcciones": [
    {{
      "campo": "<nombre del campo corregido>",
      "valor_sugerido": "<código correcto>",
      "justificacion": "<explicación clínica y normativa, máximo 100 palabras>",
      "confianza": <0.0 a 1.0>,
      "alternativas": ["<código alternativo 1>", "<código alternativo 2>"]
    }}
  ]
}}

Si no puedes sugerir una corrección con confianza >= 0.5, omite esa corrección del array.
"""

    # ── Parseo de respuesta ───────────────────

    def _parse_response(
        self, response_text: str, findings: list[Finding]
    ) -> list[AICorrection]:
        try:
            data = json.loads(response_text.strip())
            corrections: list[AICorrection] = []

            for item in data.get("correcciones", []):
                campo = item.get("campo", "")
                # Buscar el finding que corresponde a este campo
                matching_finding = next(
                    (f for f in findings if f.campo == campo or campo in f.campo), None
                )
                fila = matching_finding.numero_fila if matching_finding else -1

                corrections.append(AICorrection(
                    finding_id=f"{fila}_{campo}",
                    valor_sugerido=str(item.get("valor_sugerido", "")),
                    justificacion=str(item.get("justificacion", "")),
                    confianza=float(item.get("confianza", 0.0)),
                    alternativas=item.get("alternativas", []),
                ))

            return corrections

        except (json.JSONDecodeError, KeyError, TypeError) as e:
            print(f"[AICorrector] Error parseando respuesta: {e}\nRespuesta: {response_text[:200]}")
            return []


# ─────────────────────────────────────────────
# UTILIDAD: Merge findings + corrections
# ─────────────────────────────────────────────

def merge_corrections_into_findings(
    findings: list[Finding],
    corrections: list[AICorrection],
) -> list[Finding]:
    """Adjunta la sugerencia de la IA directamente al finding correspondiente."""
    corr_map = {c.finding_id: c for c in corrections}
    for f in findings:
        key = f"{f.numero_fila}_{f.campo}"
        if key in corr_map:
            f.sugerencia_ia = (
                f"{corr_map[key].valor_sugerido} "
                f"(confianza: {corr_map[key].confianza:.0%}) — "
                f"{corr_map[key].justificacion}"
            )
    return findings


# ─────────────────────────────────────────────
# DEMO
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import json
    from rips_parser import RIPSParser, RIPS_EJEMPLO
    from validation_engine import ValidationEngine

    # 1. Parsear
    parser = RIPSParser()
    doc    = parser.parse_string(json.dumps(RIPS_EJEMPLO))

    # 2. Validar
    engine  = ValidationEngine()
    result  = engine.validate(doc)

    # 3. Construir mapa fila → registro
    registros_map: dict[int, RegistroRIPS] = {}
    for usuario in doc.usuarios:
        for reg in usuario.registros:
            registros_map[reg.numero_fila] = reg

    # 4. Corregir con IA
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("⚠️  ANTHROPIC_API_KEY no configurada. Saltando corrección IA.")
    else:
        corrector   = AICorrector()
        corrections = corrector.correct_batch(result.findings, registros_map)
        result.findings = merge_corrections_into_findings(result.findings, corrections)

        print(f"\n✅ Correcciones IA generadas: {len(corrections)}")
        for c in corrections:
            print(f"   Campo: {c.finding_id}")
            print(f"   Sugerencia: {c.valor_sugerido} (confianza {c.confianza:.0%})")
            print(f"   Justificación: {c.justificacion}")
            print()
