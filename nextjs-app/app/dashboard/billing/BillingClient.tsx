'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import type { SubscriptionStatus } from '@/lib/subscription'

const PLANS = [
  {
    name: 'Starter',
    id: 'starter' as const,
    price: 'COP 149.000',
    period: '/mes',
    features: [
      '50 auditorías/mes',
      'Archivos hasta 10 MB',
      'Validación completa Res. 2275/2023',
      'Exportar reporte JSON',
      'Soporte por email',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
    highlight: false,
  },
  {
    name: 'Pro',
    id: 'pro' as const,
    price: 'COP 299.000',
    period: '/mes',
    features: [
      'Auditorías ilimitadas',
      'Archivos hasta 50 MB',
      'IA correctora incluida',
      'API access',
      'Soporte prioritario',
      'Multi-usuario (3 seats)',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    highlight: true,
  },
]

function BillingContent({ subscription }: { subscription: SubscriptionStatus }) {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const successParam = searchParams.get('success')
  const canceledParam = searchParams.get('canceled')
  const reason = searchParams.get('reason')

  async function handleSubscribe(priceId: string | undefined, planName: string) {
    if (!priceId) {
      setError('Configuración de precios no disponible. Contacta soporte.')
      return
    }
    setLoading(planName)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })

      if (res.status === 429) {
        setError('Demasiados intentos. Espera unos minutos e intenta de nuevo.')
        return
      }

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al iniciar el proceso de pago.')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  const periodEndFormatted = subscription.periodEndsAt
    ? new Date(subscription.periodEndsAt).toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : null

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan y facturación</h2>
      <p className="text-gray-500 mb-6">Elige el plan que mejor se adapte a tu IPS</p>

      {/* Alertas de resultado de pago */}
      {successParam && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          ✅ <strong>¡Pago exitoso!</strong> Tu suscripción se activará en unos segundos.
        </div>
      )}
      {canceledParam && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          ⚠️ Proceso de pago cancelado. Tu plan anterior sigue activo.
        </div>
      )}
      {reason === 'subscription_required' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          🔒 Necesitas un plan activo para usar las auditorías.
        </div>
      )}

      {/* Estado actual */}
      {subscription.isActive && subscription.plan && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <p className="text-blue-800">
            <strong>Plan actual:</strong> {subscription.plan.toUpperCase()}
            {subscription.estado === 'trial' && ' (Trial)'}
            {periodEndFormatted && ` · Renueva el ${periodEndFormatted}`}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Planes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
        {PLANS.map(plan => {
          const isCurrent = subscription.plan === plan.id && subscription.isActive
          return (
            <div
              key={plan.name}
              className={`rounded-xl p-6 border-2 ${
                plan.highlight
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              } ${isCurrent ? 'ring-2 ring-green-400' : ''}`}
            >
              {plan.highlight && (
                <span className="inline-block bg-blue-500 text-white text-xs px-2 py-1 rounded-full mb-3">
                  Recomendado
                </span>
              )}
              {isCurrent && (
                <span className="inline-block bg-green-500 text-white text-xs px-2 py-1 rounded-full mb-3 ml-1">
                  Plan actual
                </span>
              )}

              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.priceId, plan.name)}
                disabled={loading === plan.name || isCurrent || !plan.priceId}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition
                  ${isCurrent
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-50`}
              >
                {loading === plan.name
                  ? 'Redirigiendo a Stripe...'
                  : isCurrent
                    ? 'Plan activo'
                    : 'Suscribirse'}
              </button>
            </div>
          )
        })}
      </div>

      <p className="mt-8 text-xs text-gray-400">
        Los pagos son procesados de forma segura por Stripe. Cancela cuando quieras.
        IVA incluido según normativa colombiana.
      </p>
    </div>
  )
}

export default function BillingClient({ subscription }: { subscription: SubscriptionStatus }) {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Cargando...</div>}>
      <BillingContent subscription={subscription} />
    </Suspense>
  )
}
