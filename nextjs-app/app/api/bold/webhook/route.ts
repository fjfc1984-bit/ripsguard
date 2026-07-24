/**
 * Bold Webhook Handler
 *
 * Recibe notificaciones de Bold sobre transacciones completadas.
 * Activa/actualiza la suscripción en Supabase.
 *
 * Bold envía un POST con la información de la transacción.
 * Referencia: https://developers.bold.co/webhook
 *
 * Modelo de suscripción:
 *   - Bold no tiene suscripciones automáticas
 *   - Cada pago = 30 días de acceso
 *   - El usuario renueva manualmente cada mes
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Verifica la firma del webhook de Bold
function verifyBoldSignature(body: string, signature: string | null, secretKey: string): boolean {
  if (!signature) return false
  const expected = createHash('sha256').update(body + secretKey, 'utf8').digest('hex')
  return expected === signature
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('x-bold-signature') ||
                    request.headers.get('bold-signature')

  const secretKey = process.env.BOLD_SECRET_KEY!

  // Verificar firma (si Bold la envía en tu plan de integración)
  // Si Bold no envía signature, comenta las siguientes líneas y verifica por order_id
  if (secretKey && signature) {
    if (!verifyBoldSignature(body, signature, secretKey)) {
      console.error('[bold/webhook] Firma inválida')
      return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
    }
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  console.log('[bold/webhook] Event received:', JSON.stringify(event, null, 2))

  // Bold webhook payload (puede variar según la versión de su API)
  // Los campos clave son: order_id, status, amount, payment_method
  const orderId = event.order_id as string || event.orderId as string
  const status  = event.status as string || event.payment_status as string

  if (!orderId) {
    console.warn('[bold/webhook] No order_id in payload')
    return NextResponse.json({ received: true, warning: 'no_order_id' })
  }

  // Solo procesar transacciones aprobadas
  if (status !== 'approved' && status !== 'APPROVED') {
    console.log(`[bold/webhook] Transaction ${orderId} status: ${status} — skipping`)
    return NextResponse.json({ received: true })
  }

  // Extraer userId y planId del order_id
  // Formato: RIPS-{userId8chars}-{timestamp}
  // El planId lo guardamos en extra-data-1 del botón
  const planId = event.extra_data_1 as string || event.extraData1 as string || 'starter'
  const userIdPrefix = orderId.split('-')[1]?.toLowerCase()

  const supabase = getSupabaseAdmin()

  // Buscar el usuario por prefijo de ID (8 primeros chars sin guiones)
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, tenant_id')
    .filter('id', 'ilike', `${userIdPrefix}%`)
    .limit(1)

  if (userErr || !users || users.length === 0) {
    console.error('[bold/webhook] User not found for orderId:', orderId, userIdPrefix)
    // Retornar 200 para que Bold no reintente
    return NextResponse.json({ received: true, warning: 'user_not_found' })
  }

  const user = users[0]
  const plan = planId === 'pro' ? 'pro' : 'starter'
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + 30) // 30 días de acceso

  const { error: upsertErr } = await supabase
    .from('subscriptions')
    .upsert({
      tenant_id: user.tenant_id,
      plan,
      estado: 'activa',
      stripe_customer_id: `bold_${orderId}`,    // Reutilizamos campo para referencia Bold
      stripe_subscription_id: orderId,           // Reutilizamos campo para order_id Bold
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'tenant_id' })

  if (upsertErr) {
    console.error('[bold/webhook] Error upserting subscription:', upsertErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  console.log(`[bold/webhook] ✅ Subscription activated: tenant=${user.tenant_id}, plan=${plan}, order=${orderId}`)
  return NextResponse.json({ received: true })
}
