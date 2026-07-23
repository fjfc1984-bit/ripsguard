'use client'
import { useState } from 'react'

const PLANS = [
  {
    name: 'Starter',
    price: 'COP 149.000',
    period: '/mes',
    features: ['50 auditorías/mes', 'Validación completa 2275/2023', 'Exportar PDF', 'Soporte email'],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'COP 299.000',
    period: '/mes',
    features: ['Auditorías ilimitadas', 'IA correctora incluida', 'API access', 'Soporte prioritario', 'Multi-usuario (3 seats)'],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    highlight: true,
  },
]

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleSubscribe(priceId: string | undefined, planName: string) {
    if (!priceId) return
    setLoading(planName)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan y facturación</h2>
      <p className="text-gray-500 mb-8">Elige el plan que mejor se adapte a tu IPS</p>

      <div className="grid grid-cols-2 gap-6 max-w-2xl">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className={`rounded-xl p-6 border-2 ${plan.highlight ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
          >
            {plan.highlight && (
              <span className="inline-block bg-blue-500 text-white text-xs px-2 py-1 rounded-full mb-3">
                Recomendado
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
              disabled={loading === plan.name}
              className={`w-full py-2 rounded-lg text-sm font-semibold transition ${plan.highlight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-900 text-white hover:bg-gray-800'} disabled:opacity-50`}
            >
              {loading === plan.name ? 'Redirigiendo...' : 'Suscribirse'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
