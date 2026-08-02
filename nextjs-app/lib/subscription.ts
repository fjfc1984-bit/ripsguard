/**
 * Helpers para verificar el estado de suscripción del usuario actual.
 * Ejecutar solo en Server Components o Route Handlers (usa createClient de server).
 */

import { createClient } from '@/lib/supabase/server'

export type Plan = 'starter' | 'pro' | 'enterprise'
export type SubscriptionEstado = 'trial' | 'activa' | 'pausada' | 'cancelada' | 'vencida'

export interface SubscriptionStatus {
  plan: Plan | null
  estado: SubscriptionEstado | null
  isActive: boolean
  trialEndsAt: string | null
  periodEndsAt: string | null
  tenantId: string | null
}

const INACTIVE: SubscriptionStatus = {
  plan: null,
  estado: null,
  isActive: false,
  trialEndsAt: null,
  periodEndsAt: null,
  tenantId: null,
}

function trialStatus(tenantId: string): SubscriptionStatus {
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 14)
  return {
    plan: 'starter',
    estado: 'trial',
    isActive: true,
    trialEndsAt: trialEnd.toISOString(),
    periodEndsAt: null,
    tenantId,
  }
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return INACTIVE

  const { data: userRecord, error: userErr } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  // Usuario nuevo sin primer upload — trial activo, backend crea la fila al subir
  if (userErr || !userRecord) return trialStatus(user.id)

  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('plan, estado, trial_ends_at, current_period_end')
    .eq('tenant_id', userRecord.tenant_id)
    .single()

  if (subErr || !sub) return trialStatus(userRecord.tenant_id)

  const now = new Date()
  const isActive =
    sub.estado === 'activa' ||
    (sub.estado === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at) > now)

  return {
    plan: sub.plan as Plan,
    estado: sub.estado as SubscriptionEstado,
    isActive,
    trialEndsAt: sub.trial_ends_at ?? null,
    periodEndsAt: sub.current_period_end ?? null,
    tenantId: userRecord.tenant_id,
  }
}
