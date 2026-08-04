/**
 * Bold Webhook Handler
 *
 * Recibe notificaciones de Bold sobre transacciones completadas.
 * Activa/actualiza la suscripcion en Supabase.
 *
 * Modelo de suscripcion:
 *   - Bold no tiene suscripciones automaticas
 *   - Cada pago = 30 dias de acceso
 *   - El usuario renueva manualmente cada mes
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

const VALID_PLANS = new Set(['starter', 'pro', 'enterprise'])

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function verifyBoldSignature(body: string, signature: string | null, secretKey: string): boolean {
  if (!signature) return false
  const expected = createHash('sha256').update(body + secretKey, 'utf8').digest('hex')
  return expected === signature
}

export async function POST(request: Request) {
  const body      = await request.text()
  const signature = request.headers.get('x-bold-signature') || request.headers.get('bold-signature')
  const secretKey = process.env.BOLD_SECRET_KEY!

  if (!secretKey) {
    console.error('[bold/webhook] BOLD_SECRET_KEY no configurada')
    return NextResponse.json({ error: 'Configuracion invalida' }, { status: 500 })
  }
  if (!signature || !verifyBoldSignature(body, signature, secretKey)) {
    console.error('[bold/webhook] Firma ausente o invalida')
    return NextResponse.json({ error: 'Firma invalida' }, { status: 401 })
  }

  let event: Record<string, unknown>
  try { event = JSON.parse(body) }
  catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }

  console.log('[bold/webhook] Event received:', JSON.stringify(event, null, 2))

  const orderId = (event.order_id ?? event.orderId) as string
  const status  = (event.status ?? event.payment_status) as string

  if (!orderId) {
    console.warn('[bold/webhook] No order_id in payload')
    return NextResponse.json({ received: true, warning: 'no_order_id' })
  }

  if (status !== 'approved' && status !== 'APPROVED') {
    console.log(`[bold/webhook] Transaction ${orderId} status: ${status} — skipping`)
    return NextResponse.json({ received: true })
  }

  // extra-data-1 = planId, extra-data-2 = userId
  const rawPlanId = (event.extra_data_1 ?? event.extraData1) as string | undefined
  const userId    = (event.extra_data_2 ?? event.extraData2) as string | undefined

  // Validar que el planId sea uno de los planes conocidos
  const planId: 'starter' | 'pro' | 'enterprise' = VALID_PLANS.has(rawPlanId ?? '')
    ? (rawPlanId as 'starter' | 'pro' | 'enterprise')
    : 'starter'

  const supabase = getSupabaseAdmin()

  if (!userId) {
    console.error('[bold/webhook] userId ausente en extra_data_2, orderId:', orderId)
    return NextResponse.json({ received: true, warning: 'user_id_missing' })
  }

  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('id', userId)
    .limit(1)

  if (userErr || !users || users.length === 0) {
    console.error('[bold/webhook] User not found:', userId, 'orderId:', orderId)
    return NextResponse.json({ received: true, warning: 'user_not_found' })
  }

  const user = users[0]
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + 30)

  const { error: upsertErr } = await supabase
    .from('subscriptions')
    .upsert({
      tenant_id:              user.tenant_id,
      plan:                   planId,
      estado:                 'activa',
      stripe_customer_id:     `bold_${orderId}`,
      stripe_subscription_id: orderId,
      current_period_start:   now.toISOString(),
      current_period_end:     periodEnd.toISOString(),
      updated_at:             now.toISOString(),
    }, { onConflict: 'tenant_id' })

  if (upsertErr) {
    console.error('[bold/webhook] Error upserting subscription:', upsertErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  console.log(`[bold/webhook] Subscription activated: tenant=${user.tenant_id}, plan=${planId}, order=${orderId}`)
  return NextResponse.json({ received: true })
  }
