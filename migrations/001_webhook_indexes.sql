-- ═══════════════════════════════════════════════════════════════════
-- Migration 001: Índices para soporte de Stripe Webhooks
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- Índice para lookup rápido por stripe_subscription_id en webhooks
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id
  ON subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Índice para lookup rápido por stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Índice para verificación de suscripción activa (plan gating)
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_estado
  ON subscriptions(tenant_id, estado);

-- Verificar que RLS permite UPDATE desde service_role
-- El service_role bypasa RLS por defecto en Supabase — no se necesita policy adicional
-- Pero documentamos explícitamente la política de webhook:

COMMENT ON TABLE subscriptions IS
  'Suscripciones por tenant. Actualizada por Stripe Webhooks via service_role.
   RLS activa para usuarios normales, service_role la bypasa.';
