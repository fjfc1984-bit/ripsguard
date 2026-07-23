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
  isActive: boolean          // true si puede usar el producto
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

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const supabase = await createClient()

  // 1. Obtener usuario autenticado
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return INACTIVE

  // 2. Obtener tenant del usuario
  const { data: userRecord, error: userErr } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (userErr || !userRecord) return INACTIVE

  // 3. Obtener suscripción del tenant
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('plan, estado, trial_ends_at, current_period_end')
    .eq('tenant_id', userRecord.tenant_id)
    .single()

  if (subErr || !sub) return INACTIVE

  // 4. Determinar si está activa
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
