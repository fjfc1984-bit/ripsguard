/**
 * Stripe Webhook Handler
 *
 * Procesa eventos de Stripe para mantener el estado de suscripciones
 * sincronizado en Supabase.
 *
 * Eventos manejados:
 *   - checkout.session.completed    → activar suscripción tras pago exitoso
 *   - customer.subscription.updated → actualizar plan/estado (upgrade, downgrade, pause)
 *   - customer.subscription.deleted → marcar como cancelada
 *
 * Seguridad:
 *   - Verifica la firma HMAC de Stripe (STRIPE_WEBHOOK_SECRET)
 *   - Usa service_role key de Supabase (bypasa RLS) solo en este handler
 *   - Idempotente: usa upsert para evitar duplicados si Stripe reintenta
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

// Cliente Supabase con service_role para operaciones de webhook
// (No exponer SUPABASE_SERVICE_ROLE_KEY en el cliente browser — solo server)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Webhook no debe ser procesado por el middleware de autenticación
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // 1. Leer el body RAW (necesario para verificar la firma)
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('[webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  // 2. Verificar firma HMAC — si falla, alguien está enviando requests falsos
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[webhook] Received event: ${event.type} (${event.id})`)

  const supabase = getSupabaseAdmin()

  try {
    switch (event.type) {

      // ── Pago completado: activar suscripción ─────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        if (!userId || !subscriptionId) {
          console.warn('[webhook] checkout.session.completed missing user_id or subscriptionId')
          break
        }

        // Obtener detalles completos de la suscripción de Stripe
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = stripeSub.items.data[0]?.price.id
        const plan = resolvePlan(priceId)

        // Buscar tenant_id del usuario en Supabase
        const { data: userRecord, error: userErr } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', userId)
          .single()

        if (userErr || !userRecord) {
          // Usuario no tiene perfil en users aún — puede pasar si el webhook
          // llega antes de que el usuario complete onboarding
          console.error('[webhook] User not found in users table:', userId, userErr)
          // Retornamos 200 para que Stripe no reintente indefinidamente
          // (el próximo subscription.updated lo volverá a intentar)
          return NextResponse.json({ received: true, warning: 'user_not_found' })
        }

        // Upsert suscripción — idempotente si Stripe reintenta el evento
        const { error: upsertErr } = await supabase
          .from('subscriptions')
          .upsert({
            tenant_id: userRecord.tenant_id,
            plan,
            estado: 'activa',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'tenant_id' })

        if (upsertErr) {
          console.error('[webhook] Error upserting subscription:', upsertErr)
          return NextResponse.json({ error: 'DB error' }, { status: 500 })
        }

        console.log(`[webhook] Subscription activated for tenant ${userRecord.tenant_id}, plan: ${plan}`)
        break
      }

      // ── Suscripción actualizada: cambio de plan, pausa, renovación ───
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription
        const priceId = stripeSub.items.data[0]?.price.id
        const plan = resolvePlan(priceId)
        const estado = resolveEstado(stripeSub.status)

        const { error } = await supabase
          .from('subscriptions')
          .update({
            plan,
            estado,
            current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', stripeSub.id)

        if (error) console.error('[webhook] Error updating subscription:', error)
        else console.log(`[webhook] Subscription ${stripeSub.id} updated: ${estado}`)
        break
      }

      // ── Suscripción cancelada (por el cliente o por impago) ──────────
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription

        const { error } = await supabase
          .from('subscriptions')
          .update({
            estado: 'cancelada',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', stripeSub.id)

        if (error) console.error('[webhook] Error cancelling subscription:', error)
        else console.log(`[webhook] Subscription ${stripeSub.id} cancelled`)
        break
      }

      // ── Pago fallido: avisar pero no desactivar inmediatamente ───────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.warn(`[webhook] Payment failed for customer ${invoice.customer}`)
        // Stripe reintentará automáticamente según la configuración de retry
        // Si todos los intentos fallan → subscription.deleted se disparará
        break
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (err) {
    console.error('[webhook] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolvePlan(priceId: string | undefined): 'starter' | 'pro' {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) return 'pro'
  return 'starter'
}

function resolveEstado(
  stripeStatus: Stripe.Subscription.Status
): 'activa' | 'pausada' | 'cancelada' | 'vencida' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'activa'
    case 'paused':
      return 'pausada'
    case 'canceled':
      return 'cancelada'
    case 'past_due':
    case 'unpaid':
    case 'incomplete_expired':
      return 'vencida'
    default:
      return 'pausada'
  }
}
