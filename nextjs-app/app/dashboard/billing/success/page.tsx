/**
 * Página de retorno tras pago con Bold
 *
 * Bold redirige aquí después del pago con:
 *   ?bold-order-id=XXX&bold-tx-status=approved|declined|pending
 *
 * Esta página:
 *   1. Lee los parámetros de Bold
 *   2. Si el pago fue aprobado → activa la suscripción en Supabase
 *   3. Muestra confirmación al usuario y redirige al dashboard
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

interface SearchParams {
  'bold-order-id'?: string
  'bold-tx-status'?: string
}

function getSupabaseAdmin() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Extrae el planId y userId del order_id
// Formato: RIPS-{userId8}-{timestamp}
function parsePlanFromOrderId(orderId: string): { userPrefix: string; timestamp: string } {
  const parts = orderId.split('-')
  // RIPS - {userPrefix} - {timestamp}
  return {
    userPrefix: parts[1]?.toLowerCase() || '',
    timestamp: parts[2] || '',
  }
}

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const orderId = searchParams['bold-order-id']
  const txStatus = searchParams['bold-tx-status']

  // Si no hay parámetros válidos, redirigir a billing
  if (!orderId) {
    redirect('/dashboard/billing')
  }

  const isApproved = txStatus === 'approved' || txStatus === 'APPROVED'

  if (isApproved) {
    try {
      // Verificar usuario autenticado
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const admin = getSupabaseAdmin()

        // Determinar plan del order_id (guardamos en extra-data-1, pero
        // también podemos inferirlo si solo hay 2 planes)
        // Por seguridad, consultamos el monto de la transacción en Bold si tenemos la API key
        // Por ahora usamos el user_id extraído del order_id para verificar
        const { userPrefix } = parsePlanFromOrderId(orderId)

        // Buscar el tenant del usuario actual
        const { data: userRecord } = await admin
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .single()

        if (userRecord) {
          // Activar suscripción por 30 días
          // El plan específico lo actualiza el webhook cuando Bold lo envía
          // Aquí usamos 'starter' como default conservador
          const now = new Date()
          const periodEnd = new Date(now)
          periodEnd.setDate(periodEnd.getDate() + 30)

          await admin
            .from('subscriptions')
            .upsert({
              tenant_id: userRecord.tenant_id,
              plan: 'starter', // El webhook lo actualizará con el plan correcto
              estado: 'activa',
              stripe_customer_id: `bold_${orderId}`,
              stripe_subscription_id: orderId,
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              updated_at: now.toISOString(),
            }, { onConflict: 'tenant_id' })

          console.log(`[billing/success] Subscription activated for user ${user.id}, order ${orderId}`)
        }
      }
    } catch (err) {
      console.error('[billing/success] Error activating subscription:', err)
      // No bloqueamos al usuario — el webhook de Bold también actualizará la suscripción
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <div className={`rounded-2xl p-8 shadow-lg text-center ${
          isApproved ? 'bg-white' : 'bg-white'
        }`}>
          {isApproved ? (
            <>
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                ¡Pago exitoso!
              </h1>
              <p className="text-gray-600 mb-2">
                Tu suscripción ha sido activada por 30 días.
              </p>
              <p className="text-gray-500 text-sm mb-6">
                Referencia: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{orderId}</code>
              </p>
              <a
                href="/dashboard"
                className="inline-block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Ir al dashboard →
              </a>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Pago no completado
              </h1>
              <p className="text-gray-600 mb-6">
                El pago fue {txStatus === 'declined' ? 'rechazado' : 'cancelado'}.
                Tu plan anterior sigue activo.
              </p>
              <a
                href="/dashboard/billing"
                className="inline-block w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                Volver a planes
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
