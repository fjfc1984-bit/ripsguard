import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

// Whitelist de price IDs válidos — evita que el cliente envíe cualquier priceId
const VALID_PRICE_IDS = new Set(
  [
    process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  ].filter(Boolean)
)

export async function POST(request: Request) {
  // ── 1. Rate limiting: máx 5 intentos por IP cada 10 minutos ──────────
  const ip = getClientIp(request)
  const rl = rateLimit(`checkout:${ip}`, 5, 10 * 60 * 1000)

  if (!rl.success) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetIn / 1000)),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  // ── 2. Verificar autenticación ────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // ── 3. Validar body ───────────────────────────────────────────────────
  let body: { priceId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { priceId } = body
  if (!priceId) {
    return NextResponse.json({ error: 'priceId requerido' }, { status: 400 })
  }

  // ── 4. Whitelist — evita fraudes con price IDs arbitrarios ───────────
  if (!VALID_PRICE_IDS.has(priceId)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  // ── 5. Crear sesión de Stripe Checkout ───────────────────────────────
  try {
    const origin = new URL(request.url).origin

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      metadata: { user_id: user.id }, // Usado por el webhook para activar suscripción
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // sesión válida 30 min
      success_url: `${origin}/dashboard/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/billing?canceled=1`,
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[checkout] Stripe error:', err)
    return NextResponse.json(
      { error: 'Error al crear sesión de pago. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
