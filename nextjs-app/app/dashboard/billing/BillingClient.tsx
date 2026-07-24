'use client'
import { useState, useEffect, useRef } from 'react'
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
    highlight: true,
  },
]

interface BoldOrderData {
  orderId: string
  amount: number
  currency: string
  description: string
  integrityHash: string
  redirectionUrl: string
  planId: string
  userId: string
}

function BillingContent({ subscription }: { subscription: SubscriptionStatus }) {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [orderData, setOrderData] = useState<BoldOrderData | null>(null)
  const boldContainerRef = useRef<HTMLDivElement>(null)
  const boldScriptRef = useRef<HTMLScriptElement | null>(null)

  const successParam = searchParams.get('success')
  const canceledParam = searchParams.get('canceled')
  const reason = searchParams.get('reason')

  // Carga el script de Bold una sola vez al montar el componente
  useEffect(() => {
    if (document.querySelector('script[src*="boldPaymentButton"]')) return
    const script = document.createElement('script')
    script.src = 'https://checkout.bold.co/library/boldPaymentButton.js'
    script.async = true
    document.head.appendChild(script)
    return () => {
      // No remover el script al desmontar para evitar recargas
    }
  }, [])

  // Cuando tenemos orderData, inyectamos el botón Bold y lo activamos
  useEffect(() => {
    if (!orderData || !boldContainerRef.current) return

    // Limpiar botón anterior si existe
    if (boldScriptRef.current) {
      boldScriptRef.current.remove()
      boldScriptRef.current = null
    }
    boldContainerRef.current.innerHTML = ''

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ripsguard.com'

    // Crear script del botón Bold con todos los atributos
    const boldBtn = document.createElement('script')
    boldBtn.setAttribute('data-bold-button', 'dark-L')
    boldBtn.setAttribute('data-order-id', orderData.orderId)
    boldBtn.setAttribute('data-api-key', process.env.NEXT_PUBLIC_BOLD_API_KEY || '')
    boldBtn.setAttribute('data-amount', String(orderData.amount))
    boldBtn.setAttribute('data-currency', orderData.currency)
    boldBtn.setAttribute('data-integrity-signature', orderData.integrityHash)
    boldBtn.setAttribute('data-description', orderData.description)
    boldBtn.setAttribute('data-redirection-url', orderData.redirectionUrl)
    boldBtn.setAttribute('data-render-mode', 'embedded') // Abre como modal en la misma página
    boldBtn.setAttribute('data-extra-data-1', orderData.planId)  // Para webhook: identificar plan
    boldBtn.setAttribute('data-extra-data-2', orderData.userId.substring(0, 60)) // Para webhook: usuario

    boldContainerRef.current.appendChild(boldBtn)
    boldScriptRef.current = boldBtn

    // Bold necesita un momento para inicializar el botón en el DOM
    // Luego lo clickeamos automáticamente para abrir el checkout
    const timer = setTimeout(() => {
      const btn = boldContainerRef.current?.querySelector('button, [data-bold-checkout]')
      if (btn && btn instanceof HTMLElement) {
        btn.click()
      } else {
        // Fallback: mostrar el contenedor para que el usuario haga clic
        if (boldContainerRef.current) {
          boldContainerRef.current.style.display = 'block'
        }
      }
      setLoading(null)
    }, 800)

    return () => clearTimeout(timer)
  }, [orderData])

  async function handleSubscribe(planId: string, planName: string) {
    setLoading(planName)
    setError(null)
    setOrderData(null)

    try {
      const res = await fetch('/api/bold/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })

      if (res.status === 429) {
        setError('Demasiados intentos. Espera unos minutos e intenta de nuevo.')
        setLoading(null)
        return
      }

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al iniciar el pago.')
        setLoading(null)
        return
      }

      // Trigger Bold button render + auto-click via useEffect
      setOrderData(data)

    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
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
          const isLoading = loading === plan.name
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
                onClick={() => handleSubscribe(plan.id, plan.name)}
                disabled={isLoading || isCurrent}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition
                  ${isCurrent
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-50`}
              >
                {isLoading
                  ? 'Abriendo pago...'
                  : isCurrent
                    ? 'Plan activo'
                    : 'Suscribirse'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Contenedor oculto del botón Bold — Bold lo inicializa aquí */}
      <div
        ref={boldContainerRef}
        style={{ display: 'none', position: 'fixed', bottom: 0, left: 0 }}
        aria-hidden="true"
      />

      <p className="mt-8 text-xs text-gray-400">
        Pagos procesados de forma segura por{' '}
        <a href="https://bold.co" target="_blank" rel="noopener noreferrer" className="underline">
          Bold
        </a>{' '}
        · PSE, tarjetas débito/crédito, Nequi, Daviplata · IVA incluido según normativa colombiana.
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
