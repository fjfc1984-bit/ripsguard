/**
 * Bold Payment - Create Order
 *
 * Genera los datos necesarios para iniciar un pago con Bold:
 *   - order_id único por transacción
 *   - integrity hash SHA256 (server-side, nunca exponer secret key al cliente)
 *   - amount en COP según el plan
 *
 * Seguridad:
 *   - Requiere usuario autenticado con Supabase
 *   - Rate limiting: 5 req / 10 min por IP
 *   - BOLD_SECRET_KEY nunca llega al frontend
 */

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const PLANS = {
  starter: { amount: 149000, name: 'RIPS Guard Starter - 1 mes' },
  pro:     { amount: 299000, name: 'RIPS Guard Pro - 1 mes' },
} as const

export async function POST(request: Request) {
  // ── 1. Rate limiting ──────────────────────────────────────────────────
  const ip = getClientIp(request)
  const rl = rateLimit(`bold-order:${ip}`, 5, 10 * 60 * 1000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
    )
  }

  // ── 2. Autenticación ──────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // ── 3. Validar plan ───────────────────────────────────────────────────
  let body: { planId?: string }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Body inválido' }, { status: 400 }) }

  const { planId } = body
  if (!planId || !(planId in PLANS)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const plan = PLANS[planId as keyof typeof PLANS]

  // ── 4. Generar order_id único ─────────────────────────────────────────
  // Formato: RIPS-{8 chars userId}-{timestamp}
  const orderId = `RIPS-${user.id.replace(/-/g, '').substring(0, 8).toUpperCase()}-${Date.now()}`
  const currency = 'COP'

  // ── 5. Generar hash de integridad SHA256 (server-side) ────────────────
  // Fórmula Bold: SHA256( orderId + amount + currency + secretKey )
  const secretKey = process.env.BOLD_SECRET_KEY
  if (!secretKey) {
    console.error('[bold/create-order] BOLD_SECRET_KEY not set')
    return NextResponse.json({ error: 'Configuración de pagos no disponible' }, { status: 500 })
  }

  const hashInput = `${orderId}${plan.amount}${currency}${secretKey}`
  const integrityHash = createHash('sha256').update(hashInput, 'utf8').digest('hex')

  // ── 6. URL de redirección tras el pago ────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ripsguard.com'
  const redirectionUrl = `${appUrl}/dashboard/billing/success`

  return NextResponse.json({
    orderId,
    amount: plan.amount,
    currency,
    description: plan.name,
    integrityHash,
    redirectionUrl,
    // planId para que el success page sepa qué plan activar
    planId,
    userId: user.id,
  })
}
