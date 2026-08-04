'use client'

/**
 * OnboardingBanner — aparece en el primer acceso al dashboard.
 * Se oculta permanentemente cuando el usuario cierra el banner (X).
 * Usa localStorage para no volver a aparecer en sesiones futuras.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { XIcon, ZapIcon, SearchIcon, DownloadIcon } from '@/components/ui/icons'

const STORAGE_KEY = 'rg_onboarding_done'

const STEPS = [
  {
    num: 1,
    icon: SearchIcon,
    title: 'Sube tu primer archivo RIPS',
    desc: 'Formato JSON o ZIP · Res. 2275/2023',
    href: '/dashboard/audit',
    cta: 'Ir a auditoria',
  },
  {
    num: 2,
    icon: ZapIcon,
    title: 'Revisa el reporte de errores',
    desc: 'Con valor en riesgo y sugerencias IA',
    href: '/dashboard/history',
    cta: 'Ver historial',
  },
  {
    num: 3,
    icon: DownloadIcon,
    title: 'Exporta o descarga el reporte',
    desc: 'PDF o JSON para tu equipo de facturacion',
    href: '/dashboard/history',
    cta: 'Ver historial',
  },
]

export default function OnboardingBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY)
      if (!done) setVisible(true)
    } catch {
      // localStorage no disponible (SSR / privacy mode)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mx-8 mt-6 mb-0 bg-blue-50 border border-blue-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-bold text-blue-900">Bienvenido a RIPS Guard</h2>
          <p className="text-xs text-blue-700 mt-0.5">Comienza en 3 pasos — menos de 2 minutos</p>
        </div>
        <button
          onClick={dismiss}
          className="text-blue-400 hover:text-blue-700 transition flex-shrink-0"
          aria-label="Cerrar"
        >
          <XIcon size={16} strokeWidth={2}/>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STEPS.map((step) => {
          const Icon = step.icon
          return (
            <Link
              key={step.num}
              href={step.href}
              className="bg-white border border-blue-100 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                  {step.num}
                </div>
                <Icon size={14} className="text-blue-600" strokeWidth={2}/>
              </div>
              <p className="text-sm font-semibold text-slate-900 mb-0.5">{step.title}</p>
              <p className="text-xs text-slate-500 mb-2">{step.desc}</p>
              <span className="text-xs text-blue-600 font-semibold group-hover:underline">{step.cta} →</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
  }
