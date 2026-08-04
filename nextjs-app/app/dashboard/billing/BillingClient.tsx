'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import type { SubscriptionStatus } from '@/lib/subscription'
import { CheckIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon, ShieldIcon } from '@/components/ui/icons'

const PLANS = [
  {
    name: 'Starter',
    id: 'starter' as const,
    price: '149.000',
    highlight: false,
    badge: null,
    features: [
      '50 auditorias por mes',
      'Archivos hasta 10 MB',
      'Validacion completa Res. 2275/2023',
      'Exportar reporte JSON',
      'Soporte por email',
    ],
  },
  {
    name: 'Pro',
    id: 'pro' as const,
    price: '299.000',
    highlight: true,
    badge: 'Recomendado',
    features: [
      'Auditorias ilimitadas',
      'Archivos hasta 100 MB',
      'IA correctora incluida',
      'Acceso a API REST',
      'Soporte prioritario',
      'Multi-usuario (3 seats)',
    ],
  },
  {
    name: 'Enterprise',
    id: 'enterprise' as const,
    price: '699.000',
    highlight: false,
    badge: 'Hospitales',
    features: [
      'Auditorias ilimitadas',
      'Archivos hasta 500 MB',
      'IA correctora incluida',
      'API REST + webhooks',
      'Multi-usuario ilimitado',
      'SLA garantizado',
      'Onboarding personalizado',
    ],
  },
]

interface BoldOrderData {
  orderId: string; amount: number; currency: string; description: string
  integrityHash: string; redirectionUrl: string; planId: string; userId: string
}

function BillingContent({ subscription }: { subscription: SubscriptionStatus }) {
  const searchParams = useSearchParams()
  const [loading, setLoading]     = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [orderData, setOrderData] = useState<BoldOrderData | null>(null)
  const boldContainerRef          = useRef<HTMLDivElement>(null)
  const boldScriptRef             = useRef<HTMLScriptElement | null>(null)

  const successParam  = searchParams.get('success')
  const canceledParam = searchParams.get('canceled')
  const reason        = searchParams.get('reason')

  useEffect(() => {
    if (document.querySelector('script[src*="boldPaymentButton"]')) return
    const script = document.createElement('script')
    script.src   = 'https://checkout.bold.co/library/boldPaymentButton.js'
    script.async = true
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!orderData || !boldContainerRef.current) return
    if (boldScriptRef.current) { boldScriptRef.current.remove(); boldScriptRef.current = null }
    boldContainerRef.current.innerHTML = ''

    const boldBtn = document.createElement('script')
    boldBtn.setAttribute('data-bold-button',         'dark-L')
    boldBtn.setAttribute('data-order-id',            orderData.orderId)
    boldBtn.setAttribute('data-api-key',             process.env.NEXT_PUBLIC_BOLD_API_KEY || '')
    boldBtn.setAttribute('data-amount',              String(orderData.amount))
    boldBtn.setAttribute('data-currency',            orderData.currency)
    boldBtn.setAttribute('data-integrity-signature', orderData.integrityHash)
    boldBtn.setAttribute('data-description',         orderData.description)
    boldBtn.setAttribute('data-redirection-url',     orderData.redirectionUrl)
    boldBtn.setAttribute('data-render-mode',         'embedded')
    boldBtn.setAttribute('data-extra-data-1',        orderData.planId)
    boldBtn.setAttribute('data-extra-data-2',        orderData.userId)
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
    setLoading(planName); setError(null); setOrderData(null)
    try {
      const res = await fetch('/api/bold/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      if (res.status === 429) {
        setError('Demasiados intentos. Espera unos minutos e intenta de nuevo.')
        setLoading(null); return
      }
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al iniciar el pago.'); setLoading(null); return }
      setOrderData(data)
    } catch {
      setError('Error de conexion. Verifica tu internet.')
      setLoading(null)
    }
  }

  const periodEndFormatted = subscription.periodEndsAt
    ? new Date(subscription.periodEndsAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Plan y facturacion</h1>
        <p className="text-sm text-slate-500 mt-0.5">Elige el plan que mejor se adapte a tu organizacion</p>
      </div>

      {/* Banners */}
      {successParam && (
        <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-5 py-3.5 text-green-800 text-sm">
          <CheckCircleIcon size={18} className="text-green-600 flex-shrink-0" strokeWidth={2} />
          <span><strong>Pago exitoso.</strong> Tu suscripcion se activara en unos segundos.</span>
        </div>
      )}
      {canceledParam && (
        <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-5 py-3.5 text-amber-800 text-sm">
          <AlertCircleIcon size={18} className="text-amber-500 flex-shrink-0" strokeWidth={2} />
          <span>Proceso cancelado. Tu plan anterior sigue activo.</span>
        </div>
      )}
      {reason === 'subscription_required' && (
        <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-5 py-3.5 text-red-800 text-sm">
          <AlertCircleIcon size={18} className="text-red-500 flex-shrink-0" strokeWidth={2} />
          <span>Necesitas un plan activo para usar las auditorias.</span>
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-5 py-3.5 text-red-700 text-sm">
          <AlertCircleIcon size={18} className="text-red-500 flex-shrink-0" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

      {/* Plan actual */}
      {subscription.isActive && subscription.plan && (
        <div className="mb-6 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-5 py-3.5 text-sm">
          <InfoIcon size={16} className="text-blue-500 flex-shrink-0" strokeWidth={2} />
          <p className="text-blue-800">
            <strong>Plan actual:</strong> {subscription.plan.toUpperCase()}
            {subscription.estado === 'trial' && ' · Periodo de prueba'}
            {periodEndFormatted && <span className="text-blue-600 ml-1">· Renueva el {periodEndFormatted}</span>}
          </p>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {PLANS.map(plan => {
          const isCurrent     = subscription.plan === plan.id && subscription.isActive
          const isLoadingThis = loading === plan.name
          return (
            <div
              key={plan.name}
              className={`rounded-xl border-2 p-6 bg-white flex flex-col ${
                plan.highlight
                  ? 'border-blue-600'
                  : isCurrent ? 'border-green-400' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-bold text-slate-900">{plan.name}</h2>
                    {plan.badge && !isCurrent && (
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        plan.highlight ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white'
                      }`}>
                        {plan.badge}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-500 text-white">
                        Activo
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-slate-900 tabular-nums">COP {plan.price}</span>
                    <span className="text-slate-400 text-sm">/mes</span>
                  </div>
                </div>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <CheckIcon size={14} strokeWidth={2.5} className="text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !isCurrent && !isLoadingThis && handleSubscribe(plan.id, plan.name)}
                disabled={isLoadingThis || isCurrent || loading !== null}
                className={`w-full py-2.5 rounded-lg text-sm font-bold transition ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isLoadingThis ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Abriendo pago...
                  </span>
                ) : isCurrent ? 'Plan activo' : 'Suscribirse'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Trust strip */}
      <div className="flex items-center gap-5 pt-4 border-t border-slate-100 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldIcon size={13} strokeWidth={2} />
          Pago seguro
        </div>
        <span className="text-xs text-slate-400">PSE · Tarjetas · Nequi · Daviplata</span>
        <span className="text-xs text-slate-400">IVA incluido</span>
        <span className="text-xs text-slate-400">Cancela cuando quieras</span>
        <a href="https://bold.co" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-slate-600 underline ml-auto">
          Powered by Bold
        </a>
      </div>

      {/* Bold container oculto */}
      <div ref={boldContainerRef} style={{ display: 'none', position: 'fixed', bottom: 0, left: 0 }} aria-hidden="true" />
    </div>
  )
}

export default function BillingClient({ subscription }: { subscription: SubscriptionStatus }) {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 text-sm">Cargando...</div>}>
      <BillingContent subscription={subscription} />
    </Suspense>
  )
    }
