"""
RIPS Guard — Integración de Pagos con Stripe
=============================================
Maneja suscripciones recurrentes en COP (pesos colombianos)
con tres planes: Starter $350K, Pro $1.2M, Enterprise (custom)

Endpoints:
  POST /billing/checkout          → Crear sesión de pago (Stripe Checkout)
  POST /billing/portal            → Portal de cliente (gestión de suscripción)
  POST /billing/webhook           → Webhook de Stripe (eventos de suscripción)
  GET  /billing/plans             → Listar planes disponibles

Setup:
  1. Crear cuenta en https://stripe.com
  2. Activar pagos en COP (Colombia): Dashboard → Settings → Currencies → COP
  3. Crear los 3 productos en Stripe (ver create_stripe_products() abajo)
  4. Configurar webhook endpoint: https://tu-api.com/billing/webhook
  5. Copiar Webhook Signing Secret a STRIPE_WEBHOOK_SECRET

Variables de entorno requeridas:
  STRIPE_SECRET_KEY          sk_live_... (o sk_test_... en desarrollo)
  STRIPE_WEBHOOK_SECRET      whsec_...
  STRIPE_PRICE_STARTER       price_...
  STRIPE_PRICE_PRO           price_...
  SUPABASE_URL               https://xxx.supabase.co
  SUPABASE_SERVICE_KEY       eyJ... (service_role key — NUNCA exponer al cliente)
  APP_URL                    https://app.ripsguard.co (o localhost en dev)
"""

from __future__ import annotations

import os
import json
import logging
from datetime import datetime, timezone
from typing import Any

import stripe
from fastapi import FastAPI, Header, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# CONFIG STRIPE
# ─────────────────────────────────────────────

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "sk_test_REEMPLAZAR")

WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "whsec_REEMPLAZAR")
APP_URL        = os.environ.get("APP_URL", "http://localhost:3000")

# IDs de precios en Stripe (se crean una sola vez — ver create_stripe_products())
PRICE_IDS = {
    "starter": os.environ.get("STRIPE_PRICE_STARTER", "price_REEMPLAZAR_STARTER"),
    "pro":     os.environ.get("STRIPE_PRICE_PRO",     "price_REEMPLAZAR_PRO"),
    # Enterprise: precio manual, sin Stripe Checkout
}

# Definición de planes (para mostrar en UI)
PLANES = {
    "starter": {
        "nombre":          "Starter",
        "precio_cop":      350_000,
        "precio_usd":      90,        # aprox. para facturación internacional
        "max_registros":   50_000,
        "usuarios":        3,
        "descripcion":     "Para IPS pequeñas y profesionales independientes",
        "features": [
            "Hasta 50.000 registros/mes",
            "3 usuarios",
            "Motor de validación completo (3.000+ reglas)",
            "Reporte PDF descargable",
            "Soporte por email",
        ],
        "stripe_price_id": PRICE_IDS["starter"],
    },
    "pro": {
        "nombre":          "Pro",
        "precio_cop":      1_200_000,
        "precio_usd":      310,
        "max_registros":   500_000,
        "usuarios":        10,
        "descripcion":     "Para clínicas y hospitales medianos",
        "popular":         True,
        "features": [
            "Hasta 500.000 registros/mes",
            "10 usuarios",
            "IA correctora de CUPS/CIE-10",
            "Dashboard en tiempo real",
            "API access",
            "Soporte prioritario",
        ],
        "stripe_price_id": PRICE_IDS["pro"],
    },
    "enterprise": {
        "nombre":          "Enterprise",
        "precio_cop":      None,      # Precio a la medida
        "descripcion":     "Para grandes hospitales y redes de IPS",
        "features": [
            "Registros ilimitados",
            "Usuarios ilimitados",
            "Multi-sede / multi-NIT",
            "SLA garantizado 99.9%",
            "Integración directa con HIS",
            "Soporte dedicado 24/7",
        ],
        "stripe_price_id": None,
    },
}


# ─────────────────────────────────────────────
# MODELOS PYDANTIC
# ─────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan:       str              # "starter" o "pro"
    tenant_id:  str
    email:      str
    nombre:     str

class PortalRequest(BaseModel):
    tenant_id:  str
    stripe_customer_id: str


# ─────────────────────────────────────────────
# SUPABASE CLIENT (para actualizar suscripciones)
# ─────────────────────────────────────────────

def get_supabase():
    """
    Retorna cliente Supabase con service_role key (bypass RLS).
    Instalar: pip install supabase
    """
    try:
        from supabase import create_client
        return create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"]
        )
    except Exception as e:
        logger.warning(f"Supabase no configurado: {e}")
        return None


# ─────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────

app = FastAPI(title="RIPS Guard — Billing API", version="0.1.0")


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/billing/plans")
async def list_plans():
    """Retorna los planes disponibles (para mostrar en la UI)."""
    return {"planes": PLANES}


@app.post("/billing/checkout")
async def create_checkout_session(req: CheckoutRequest):
    """
    Crea una sesión de Stripe Checkout para el plan solicitado.
    Retorna la URL de pago a la que redirigir al usuario.
    """
    if req.plan not in ("starter", "pro"):
        raise HTTPException(400, f"Plan inválido: {req.plan}. Use 'starter' o 'pro'.")

    plan = PLANES[req.plan]

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            customer_email=req.email,
            line_items=[{
                "price":    plan["stripe_price_id"],
                "quantity": 1,
            }],
            # Metadata que llegará en el webhook
            metadata={
                "tenant_id":  req.tenant_id,
                "plan":       req.plan,
                "nombre_ips": req.nombre,
            },
            subscription_data={
                "metadata": {
                    "tenant_id": req.tenant_id,
                    "plan":      req.plan,
                },
                # Trial de 14 días desde Stripe (además del trial en BD)
                "trial_period_days": 14,
            },
            success_url=f"{APP_URL}/dashboard?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{APP_URL}/precios?checkout=cancelled",
            # Opciones locales (Colombia)
            locale="es",
            currency="cop",
        )
        return {"checkout_url": session.url, "session_id": session.id}

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error en checkout: {e}")
        raise HTTPException(502, f"Error al crear sesión de pago: {e.user_message}")


@app.post("/billing/portal")
async def create_customer_portal(req: PortalRequest):
    """
    Crea una sesión del Portal de Cliente de Stripe.
    Permite al usuario gestionar su tarjeta, ver facturas y cancelar.
    """
    try:
        session = stripe.billing_portal.Session.create(
            customer=req.stripe_customer_id,
            return_url=f"{APP_URL}/dashboard/configuracion",
        )
        return {"portal_url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(502, f"Error al abrir portal: {e.user_message}")


@app.post("/billing/webhook")
async def stripe_webhook(request: Request):
    """
    Recibe y procesa eventos de Stripe.
    Actualiza la tabla 'subscriptions' en Supabase según el evento.

    Eventos manejados:
      - checkout.session.completed      → Activar suscripción
      - customer.subscription.updated   → Cambio de plan
      - customer.subscription.deleted   → Cancelación
      - invoice.payment_failed          → Fallo de pago
      - invoice.payment_succeeded       → Renovación exitosa
    """
    payload   = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    # Verificar firma del webhook (seguridad)
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        logger.warning("Webhook: firma inválida")
        raise HTTPException(400, "Firma inválida")
    except Exception as e:
        raise HTTPException(400, f"Payload inválido: {e}")

    logger.info(f"Webhook recibido: {event['type']}")

    # Despachar evento
    handlers = {
        "checkout.session.completed":    _handle_checkout_completed,
        "customer.subscription.updated": _handle_subscription_updated,
        "customer.subscription.deleted": _handle_subscription_deleted,
        "invoice.payment_succeeded":     _handle_payment_succeeded,
        "invoice.payment_failed":        _handle_payment_failed,
    }

    handler = handlers.get(event["type"])
    if handler:
        await handler(event["data"]["object"])

    return {"received": True}


# ─────────────────────────────────────────────
# HANDLERS DE EVENTOS STRIPE
# ─────────────────────────────────────────────

async def _handle_checkout_completed(session: dict):
    """Checkout completado → activar suscripción en Supabase."""
    tenant_id  = session.get("metadata", {}).get("tenant_id")
    plan       = session.get("metadata", {}).get("plan", "starter")
    customer   = session.get("customer")
    sub_id     = session.get("subscription")

    if not tenant_id:
        logger.error("checkout.completed sin tenant_id en metadata")
        return

    # Obtener detalles de la suscripción creada
    sub = stripe.Subscription.retrieve(sub_id) if sub_id else {}

    _update_supabase_subscription(tenant_id, {
        "estado":                  "activa",
        "plan":                    plan,
        "stripe_customer_id":      customer,
        "stripe_subscription_id":  sub_id,
        "current_period_start":    _ts(sub.get("current_period_start")),
        "current_period_end":      _ts(sub.get("current_period_end")),
        "precio_cop":              PLANES[plan]["precio_cop"],
        "max_registros_mes":       PLANES[plan]["max_registros"],
    })
    logger.info(f"Suscripción activada: tenant={tenant_id} plan={plan}")


async def _handle_subscription_updated(sub: dict):
    """Suscripción actualizada → sincronizar estado."""
    tenant_id = (sub.get("metadata") or {}).get("tenant_id")
    if not tenant_id:
        return

    # Mapear estado de Stripe a nuestro ENUM
    estado_map = {
        "active":   "activa",
        "trialing": "trial",
        "past_due": "activa",      # Permitir acceso con pago pendiente
        "paused":   "pausada",
        "canceled": "cancelada",
    }
    nuevo_estado = estado_map.get(sub.get("status"), "activa")

    _update_supabase_subscription(tenant_id, {
        "estado":              nuevo_estado,
        "current_period_end":  _ts(sub.get("current_period_end")),
    })


async def _handle_subscription_deleted(sub: dict):
    """Suscripción cancelada → degradar a plan gratuito / bloquear."""
    tenant_id = (sub.get("metadata") or {}).get("tenant_id")
    if not tenant_id:
        return

    _update_supabase_subscription(tenant_id, {
        "estado": "cancelada",
        "plan":   "starter",
    })
    logger.info(f"Suscripción cancelada: tenant={tenant_id}")


async def _handle_payment_succeeded(invoice: dict):
    """Pago exitoso → registrar fecha de renovación."""
    sub_id = invoice.get("subscription")
    if not sub_id:
        return
    sub = stripe.Subscription.retrieve(sub_id)
    tenant_id = (sub.get("metadata") or {}).get("tenant_id")
    if tenant_id:
        _update_supabase_subscription(tenant_id, {
            "estado":              "activa",
            "current_period_end":  _ts(sub.get("current_period_end")),
        })


async def _handle_payment_failed(invoice: dict):
    """Pago fallido → marcar para notificar al cliente."""
    sub_id = invoice.get("subscription")
    if not sub_id:
        return
    sub = stripe.Subscription.retrieve(sub_id)
    tenant_id = (sub.get("metadata") or {}).get("tenant_id")
    if tenant_id:
        logger.warning(f"Pago fallido: tenant={tenant_id}")
        # En producción: enviar email de alerta al owner del tenant


# ─────────────────────────────────────────────
# UTILIDADES
# ─────────────────────────────────────────────

def _ts(unix_timestamp: int | None) -> str | None:
    """Convierte timestamp Unix a ISO 8601 para Supabase."""
    if unix_timestamp is None:
        return None
    return datetime.fromtimestamp(unix_timestamp, tz=timezone.utc).isoformat()


def _update_supabase_subscription(tenant_id: str, data: dict):
    """Actualiza la suscripción en Supabase."""
    sb = get_supabase()
    if not sb:
        logger.warning(f"Supabase no disponible — no se actualizó tenant={tenant_id}")
        return
    try:
        sb.table("subscriptions").update(data).eq("tenant_id", tenant_id).execute()
    except Exception as e:
        logger.error(f"Error actualizando Supabase: {e}")


# ─────────────────────────────────────────────
# SCRIPT: Crear productos en Stripe (ejecutar 1 vez)
# ─────────────────────────────────────────────

def create_stripe_products():
    """
    Crear los productos y precios en Stripe.
    Ejecutar UNA SOLA VEZ desde terminal:
        python stripe_integration.py setup
    Luego copiar los price_IDs al .env
    """
    print("Creando productos en Stripe...")

    # Producto Starter
    prod_starter = stripe.Product.create(
        name="RIPS Guard Starter",
        description="Auditoría RIPS con IA — hasta 50.000 registros/mes",
        metadata={"plan": "starter"},
    )
    price_starter = stripe.Price.create(
        product=prod_starter.id,
        unit_amount=35000000,   # COP en centavos (Stripe COP = centavos) → $350.000 COP
        currency="cop",
        recurring={"interval": "month"},
        nickname="Starter Mensual COP",
    )
    print(f"✅ Starter Price ID: {price_starter.id}")

    # Producto Pro
    prod_pro = stripe.Product.create(
        name="RIPS Guard Pro",
        description="Auditoría RIPS con IA + Corrector IA — hasta 500.000 registros/mes",
        metadata={"plan": "pro"},
    )
    price_pro = stripe.Price.create(
        product=prod_pro.id,
        unit_amount=120000000,  # $1.200.000 COP en centavos
        currency="cop",
        recurring={"interval": "month"},
        nickname="Pro Mensual COP",
    )
    print(f"✅ Pro Price ID: {price_pro.id}")

    print("\n📋 Copia estos valores a tu .env:")
    print(f"STRIPE_PRICE_STARTER={price_starter.id}")
    print(f"STRIPE_PRICE_PRO={price_pro.id}")

    return {
        "starter": price_starter.id,
        "pro":     price_pro.id,
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "setup":
        create_stripe_products()
    else:
        import uvicorn
        uvicorn.run("stripe_integration:app", host="0.0.0.0", port=8001, reload=True)
