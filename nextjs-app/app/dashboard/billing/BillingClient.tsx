'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import type { SubscriptionStatus } from '@/lib/subscription'

const PLANS = [
  {
    name: 'Starter',
    id: 'starter' as const,
    price: '149.000',
    period: '/mes',
    badge: null,
    color: 'border-slate-200 bg-white',
    btnClass: 'bg-slate-900 text-white hover:bg-slate-800',
    features: [
      { icon: '🔍', text: '50 auditorías por mes' },
      { icon: '📁', text: 'Archivos hasta 10 MB' },
      { icon: '✅', text: 'Validación completa Res. 2275/2023' },
      { icon: '📤', text: 'Exportar reporte JSON' },
      { icon: '📧', text: 'Soporte por email' },
    ],
  },
  {
    name: 'Pro',
    id: 'pro' as const,
    price: '299.000',
    period: '/mes',
    badge: 'Recomendado',
    color: 'border-blue-500 bg-gradient-to-b from-blue-50 to-white ring-2 ring-blue-100',
    btnClass: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200',
    features: [
      { icon: '♾️', text: 'Auditorías ilimitadas' },
      { icon: '📁', text: 'Archivos hasta 50 MB' },
      { icon: '🤖', text: 'IA correctora incluida' },
      { icon: '🔌', text: 'Acceso a API REST' },
      { icon: '⚡', text: 'Soporte prioritario' },
      { icon: '👥', text: 'Multi-usuario (3 seats)' },
    ],
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

  useEffect(() => {
    if (document.querySelector('script[src*="boldPaymentButton"]')) return
    const script = document.createElement('script')
    script.src = 'https://checkout.bold.co/library/boldPaymentButton.js'
    script.async = true
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!orderData || !boldContainerRef.current) return
    if (boldScriptRef.current) { boldScriptRef.current.remove(); boldScriptRef.current = null }
    boldContainerRef.current.innerHTML = ''

    const boldBtn = document.createElement('script')
    boldBtn.setAttribute('data-bold-button', 'dark-L')
    boldBtn.setAttribute('data-order-id', orderData.orderId)
    boldBtn.setAttribute('data-api-key', process.env.NEXT_PUBLIC_BOLD_API_KEY || '')
    boldBtn.setAttribute('data-amount', String(orderData.amount))
    boldBtn.setAttribute('data-currency', orderData.currency)
    boldBtn.setAttribute('data-integrity-signature', orderData.integrityHash)
    boldBtn.setAttribute('data-description', orderData.description)
    boldBtn.setAttribute('data-redirection-url', orderData.redirectionUrl)
    boldBtn.setAttribute('data-render-mode', 'embedded')
    boldBtn.setAttribute('data-extra-data-1', orderData.planId)
    boldBtn.setAttribute('data-extra-data-2', orderData.userId.substring(0, 60))
    boldContainerRef.current.appendChild(boldBtn)
    boldScriptRef.current = boldBtn

    const timer = setTimeout(() => {
      const btn = boldContainerRef.current?.querySelector('button, [data-bold-checkout]')
      if (btn && btn instanceof HTMLElement) btn.click()
      else if (boldContainerRef.current) boldContainerRef.current.style.display = 'block'
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
      setOrderData(data)
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
      setLoading(null)
    }
  }

  const periodEndFormatted = subscription.periodEndsAt
    ? new Date(subscription.periodEndsAt).toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Plan y facturación</h2>
        <p className="text-slate-500 text-sm mt-1">Elige el plan que mejor se adapte a tu IPS o clínica</p>
      </div>

      {/* Banners */}
      {successParam && (
        <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-green-800 text-sm">
          <span className="text-xl">🎉</span>
          <span><strong>¡Pago exitoso!</strong> Tu suscripción se activará en unos segundos. Recarga si no ves el cambio.</span>
        </div>
      )}
      {canceledParam && (
        <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-800 text-sm">
          <span className="text-xl">⚠️</span>
          <span>Proceso de pago cancelado. Tu plan anterior sigue activo.</span>
        </div>
      )}
      {reason === 'subscription_required' && (
        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-800 text-sm">
          <span className="text-xl">🔒</span>
          <span>Necesitas un plan activo para usar las auditorías.</span>
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm">
          <span>⚠️</span> <span>{error}</span>
        </div>
      )}

      {/* Estado actual */}
      {subscription.isActive && subscription.plan && (
        <div className="mb-6 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5 text-sm">
          <span className="text-lg">📋</span>
          <p className="text-blue-800">
            <strong>Plan actual:</strong> {subscription.plan.toUpperCase()}
            {subscription.estado === 'trial' && ' · Periodo de prueba'}
            {periodEndFormatted && (
              <span className="text-blue-600 ml-2 font-normal">Renueva el {periodEndFormatted}</span>
            )}
          </p>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {PLANS.map(plan => {
          const isCurrent = subscription.plan === plan.id && subscription.isActive
          const isLoadingThis = loading === plan.name
          return (
            <div
              key={plan.name}
              className={`rounded-2xl border-2 p-6 transition-all ${plan.color} ${isCurrent ? 'ring-2 ring-green-400' : ''}`}
            >
              {/* Badges */}
              <div className="flex items-center gap-2 mb-4 min-h-[24px]">
                {plan.badge && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-600 text-white">
                    {plan.badge}
                  </span>
                )}
                {isCurrent && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500 text-white">
                    ✓ Plan actual
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
              <div className="mb-5">
                <span className="text-3xl font-extrabold text-slate-900">COP {plan.price}</span>
                <span className="text-slate-400 text-sm ml-1">{plan.period}</span>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map(f => (
                  <li key={f.text} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <span>{f.icon}</span>
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !isCurrent && !isLoadingThis && handleSubscribe(plan.id, plan.name)}
                disabled={isLoadingThis || isCurrent || loading !== null}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : plan.btnClass
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isLoadingThis ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Abriendo pago...
                  </span>
                ) : isCurrent ? '✓ Plan activo' : 'Suscribirse →'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Trust bar */}
      <div className="flex items-center gap-4 py-4 border-t border-slate-100 flex-wrap">
        {['🔒 Pago seguro', '🏦 PSE · Tarjetas · Nequi · Daviplata', '🇨🇴 IVA incluido', '❌ Cancela cuando quieras'].map(t => (
          <span key={t} className="text-xs text-slate-400">{t}</span>
        ))}
        <a
          href="https://bold.co"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-slate-600 underline ml-auto"
        >
          Powered by Bold
        </a>
      </div>

      {/* Contenedor Bold oculto */}
      <div
        ref={boldContainerRef}
        style={{ display: 'none', position: 'fixed', bottom: 0, left: 0 }}
        aria-hidden="true"
      />
    </div>
  )
}

export default function BillingClient({ subscription }: { subscription: SubscriptionStatus }) {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Cargando...</div>}>
      <BillingContent subscription={subscription} />
    </Suspense>
  )
}
