"""
RIPS Guard — Servicio de Email Transaccional (Resend)
=====================================================
Emails automáticos con plantillas HTML profesionales para:
  1. Bienvenida (registro)
  2. Auditoría completada (resultado listo)
  3. Trial por vencer (7 y 3 días)
  4. Pago fallido
  5. Resumen semanal

Setup:
  1. Crear cuenta gratuita en https://resend.com (100 emails/día gratis)
  2. Verificar tu dominio ripsguard.co en Resend → DNS records
  3. Obtener API Key y agregar a .env: RESEND_API_KEY=re_...

Install: pip install resend
"""

from __future__ import annotations

import os
import logging
from dataclasses import dataclass
from typing import Any

import resend

logger = logging.getLogger(__name__)

resend.api_key = os.environ.get("RESEND_API_KEY", "re_REEMPLAZAR")

EMAIL_FROM = os.environ.get("EMAIL_FROM", "RIPS Guard <noreplay@ripsguard.co>")
APP_URL    = os.environ.get("APP_URL",    "https://app.ripsguard.co")


# ─────────────────────────────────────────────
# BASE TEMPLATE (HTML)
# ─────────────────────────────────────────────

def _base_template(content: str, preheader: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>RIPS Guard</title>
</head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#f9fafb;">
<!-- Preheader oculto -->
<div style="display:none;max-height:0;overflow:hidden;">{preheader}</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="padding-bottom:32px;text-align:center;">
        <a href="{APP_URL}" style="text-decoration:none;font-size:24px;font-weight:800;color:#f9fafb;">
          🛡️ RIPS<span style="color:#60a5fa;">Guard</span>
        </a>
        <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Auditoría de Facturación Médica con IA</p>
      </td></tr>

      <!-- Contenido -->
      <tr><td style="background:#111827;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:32px;">
        {content}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding-top:24px;text-align:center;">
        <p style="font-size:12px;color:#4b5563;margin:0;">
          © 2024 RIPS Guard · Colombia<br/>
          Basado en Resolución 2275 de 2023 · Ley 1581/2012
        </p>
        <p style="font-size:11px;color:#374151;margin:8px 0 0;">
          <a href="{APP_URL}/configuracion" style="color:#6b7280;">Gestionar notificaciones</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""


# ─────────────────────────────────────────────
# PLANTILLAS
# ─────────────────────────────────────────────

def _template_bienvenida(nombre: str, institucion: str, trial_dias: int = 30) -> tuple[str, str]:
    """Email de bienvenida al registrarse."""
    subject = f"¡Bienvenido a RIPS Guard, {nombre.split()[0]}! Tu trial está activo"
    content = f"""
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">¡Bienvenido, {nombre.split()[0]}! 🎉</h1>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">Tu cuenta de RIPS Guard para <strong style="color:#f9fafb;">{institucion}</strong> está lista.</p>

    <div style="background:#0a0e1a;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid rgba(59,130,246,.2);">
      <p style="margin:0 0 12px;font-size:13px;color:#9ca3af;">Tu trial incluye:</p>
      <ul style="margin:0;padding:0 0 0 20px;color:#f9fafb;font-size:14px;line-height:1.8;">
        <li>✅ <strong>{trial_dias} días</strong> de acceso completo al plan Pro</li>
        <li>✅ Hasta <strong>500.000 registros</strong> por auditoría</li>
        <li>✅ Corrector IA de CUPS/CIE-10 (Claude)</li>
        <li>✅ 3.000+ reglas de validación (Res. 2275/2023)</li>
        <li>✅ Sin tarjeta de crédito requerida</li>
      </ul>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <a href="{APP_URL}/dashboard/nueva-auditoria" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
            Subir mi primer RIPS →
          </a>
        </td>
      </tr>
    </table>

    <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:20px;">
      <p style="font-size:13px;color:#9ca3af;margin:0 0 8px;"><strong style="color:#f9fafb;">¿Necesitas ayuda?</strong></p>
      <p style="font-size:13px;color:#9ca3af;margin:0;">
        Escríbenos a <a href="mailto:hola@ripsguard.co" style="color:#60a5fa;">hola@ripsguard.co</a>
        o agenda una demo de 30 minutos:
        <a href="{APP_URL}/demo" style="color:#60a5fa;">ripsguard.co/demo</a>
      </p>
    </div>
    """
    return subject, _base_template(content, f"Tu cuenta está activa — {trial_dias} días gratis para auditar tu RIPS")


def _template_auditoria_completada(
    nombre: str,
    archivo: str,
    total_registros: int,
    total_errores: int,
    total_criticos: int,
    valor_en_riesgo: int,
    session_id: str,
) -> tuple[str, str]:
    """Email cuando la auditoría termina (archivos grandes en background)."""
    cop = lambda v: f"${v:,.0f}".replace(',', '.')
    subject = f"✅ Auditoría lista — {total_criticos} errores críticos en {archivo}"

    color_criticos = "#ef4444" if total_criticos > 0 else "#22c55e"
    alerta = f"""
    <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:8px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;color:#f87171;">
        ⚠️ <strong>{total_criticos} errores críticos</strong> encontrados. Corrígelos antes de radicar a la EPS para evitar glosas.
      </p>
    </div>
    """ if total_criticos > 0 else ""

    content = f"""
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;">Tu auditoría está lista ✅</h1>
    <p style="color:#9ca3af;font-size:13px;margin:0 0 20px;">Archivo: <code style="color:#60a5fa;">{archivo}</code></p>

    {alerta}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td width="25%" align="center" style="background:#0a0e1a;border-radius:10px;padding:16px;margin:4px;">
          <div style="font-size:22px;font-weight:800;color:#60a5fa;">{total_registros:,}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Registros</div>
        </td>
        <td width="4%"></td>
        <td width="25%" align="center" style="background:#0a0e1a;border-radius:10px;padding:16px;">
          <div style="font-size:22px;font-weight:800;color:#f59e0b;">{total_errores}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Errores</div>
        </td>
        <td width="4%"></td>
        <td width="25%" align="center" style="background:#0a0e1a;border-radius:10px;padding:16px;">
          <div style="font-size:22px;font-weight:800;color:{color_criticos};">{total_criticos}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">Críticos</div>
        </td>
        <td width="4%"></td>
        <td width="25%" align="center" style="background:#0a0e1a;border-radius:10px;padding:16px;">
          <div style="font-size:18px;font-weight:800;color:#22c55e;">{cop(valor_en_riesgo)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:.5px;">En riesgo</div>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="{APP_URL}/dashboard/auditoria/{session_id}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:700;">
          Ver hallazgos y corregir →
        </a>
      </td></tr>
    </table>
    """
    return subject, _base_template(content, f"{total_criticos} críticos · {cop(valor_en_riesgo)} en riesgo de glosa")


def _template_trial_por_vencer(nombre: str, dias_restantes: int) -> tuple[str, str]:
    """Alerta de trial próximo a vencer."""
    urgente = dias_restantes <= 3
    subject = f"{'⏰ Urgente: ' if urgente else ''}Tu trial vence en {dias_restantes} días — RIPS Guard"
    content = f"""
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;">{'⏰ ' if urgente else ''}Tu trial vence en <span style="color:{'#ef4444' if urgente else '#f59e0b'};">{dias_restantes} días</span></h1>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">Hola {nombre.split()[0]}, no pierdas el acceso a tu auditor de RIPS.</p>

    <div style="background:#0a0e1a;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:600;">Cuando se venza el trial:</p>
      <ul style="margin:0;padding:0 0 0 20px;color:#9ca3af;font-size:13px;line-height:1.8;">
        <li>❌ No podrás subir nuevos archivos RIPS</li>
        <li>❌ No tendrás acceso a las correcciones de IA</li>
        <li>✅ Tus reportes anteriores estarán guardados</li>
      </ul>
    </div>

    <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:13px;color:#9ca3af;margin-bottom:8px;">Plan Pro mensual</div>
      <div style="font-size:32px;font-weight:800;color:#f9fafb;">$1.200.000 <span style="font-size:16px;font-weight:400;color:#9ca3af;">COP/mes</span></div>
      <div style="font-size:13px;color:#9ca3af;margin-top:6px;">ROI típico: $12–40M recuperados en el primer mes</div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="{APP_URL}/precios" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
          Activar mi suscripción →
        </a>
      </td></tr>
    </table>
    <p style="text-align:center;font-size:12px;color:#4b5563;margin-top:12px;">Garantía: si no ves resultados en 30 días, te devolvemos el dinero.</p>
    """
    return subject, _base_template(content, f"Tu acceso a RIPS Guard vence en {dias_restantes} días")


def _template_pago_fallido(nombre: str, monto: str, ultimo4: str) -> tuple[str, str]:
    """Email de pago fallido."""
    subject = "⚠️ Pago fallido — Actualiza tu método de pago en RIPS Guard"
    content = f"""
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;">Hubo un problema con tu pago ⚠️</h1>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
      No pudimos cobrar <strong style="color:#f9fafb;">{monto}</strong> a la tarjeta terminada en <strong style="color:#f9fafb;">****{ultimo4}</strong>.
    </p>

    <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#f87171;">
        Tienes <strong>3 intentos</strong> más antes de que tu cuenta sea suspendida.
        Actualiza tu método de pago para evitar interrupciones.
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="{APP_URL}/dashboard/configuracion/facturacion" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:700;">
          Actualizar método de pago →
        </a>
      </td></tr>
    </table>

    <p style="text-align:center;font-size:13px;color:#9ca3af;margin-top:20px;">
      ¿Necesitas ayuda? Escríbenos a <a href="mailto:hola@ripsguard.co" style="color:#60a5fa;">hola@ripsguard.co</a>
    </p>
    """
    return subject, _base_template(content, "Actualiza tu método de pago para mantener el acceso")


def _template_resumen_semanal(
    nombre: str,
    institucion: str,
    semana: str,
    sesiones: int,
    registros: int,
    errores_evitados: int,
    valor_protegido: int,
) -> tuple[str, str]:
    """Resumen semanal de actividad."""
    cop = lambda v: f"${v:,.0f}".replace(',', '.')
    subject = f"📊 Tu resumen RIPS Guard — semana {semana}"
    content = f"""
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;">Tu semana en RIPS Guard 📊</h1>
    <p style="color:#9ca3af;font-size:13px;margin:0 0 24px;">{institucion} · Semana del {semana}</p>

    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="background:#0a0e1a;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#60a5fa;">{sesiones}</div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Auditorías</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#0a0e1a;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#f59e0b;">{registros:,}</div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Registros</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#0a0e1a;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#22c55e;">{errores_evitados}</div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Errores evitados</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:18px;font-weight:800;color:#22c55e;">{cop(valor_protegido)}</div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Protegido de glosas</div>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="{APP_URL}/dashboard" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
          Ver dashboard completo →
        </a>
      </td></tr>
    </table>
    """
    return subject, _base_template(content, f"{cop(valor_protegido)} protegidos de glosas esta semana")


# ─────────────────────────────────────────────
# SERVICIO PRINCIPAL
# ─────────────────────────────────────────────

class EmailService:

    def _send(self, to: str, subject: str, html: str) -> bool:
        """Envía un email vía Resend. Retorna True si fue exitoso."""
        try:
            params = resend.Emails.SendParams(
                from_=EMAIL_FROM,
                to=[to],
                subject=subject,
                html=html,
            )
            resend.Emails.send(params)
            logger.info(f"Email enviado: {subject} → {to}")
            return True
        except Exception as e:
            logger.error(f"Error enviando email a {to}: {e}")
            return False

    def send_bienvenida(self, to: str, nombre: str, institucion: str) -> bool:
        subject, html = _template_bienvenida(nombre, institucion)
        return self._send(to, subject, html)

    def send_auditoria_completada(self, to: str, nombre: str, **kwargs) -> bool:
        subject, html = _template_auditoria_completada(nombre, **kwargs)
        return self._send(to, subject, html)

    def send_trial_por_vencer(self, to: str, nombre: str, dias_restantes: int) -> bool:
        subject, html = _template_trial_por_vencer(nombre, dias_restantes)
        return self._send(to, subject, html)

    def send_pago_fallido(self, to: str, nombre: str, monto: str, ultimo4: str) -> bool:
        subject, html = _template_pago_fallido(nombre, monto, ultimo4)
        return self._send(to, subject, html)

    def send_resumen_semanal(self, to: str, nombre: str, **kwargs) -> bool:
        subject, html = _template_resumen_semanal(nombre, **kwargs)
        return self._send(to, subject, html)


# Singleton global
email_service = EmailService()


# ─────────────────────────────────────────────
# DEMO
# ─────────────────────────────────────────────

if __name__ == "__main__":
    # Previsualizar plantillas en browser (no envía email)
    import webbrowser, tempfile, os

    _, html = _template_bienvenida("Dr. Fernando Fonseca", "Clínica Medisalud S.A.S.")
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html)
        webbrowser.open(f"file://{f.name}")
        print(f"Preview: {f.name}")
