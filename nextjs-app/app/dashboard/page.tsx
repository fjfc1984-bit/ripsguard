import Link from 'next/link'
import { getSubscriptionStatus } from '@/lib/subscription'
import { createClient } from '@/lib/supabase/server'
import { SearchIcon, BarChartIcon, AlertTriangleIcon, ShieldIcon, ZapIcon, HistoryIcon } from '@/components/ui/icons'

async function getDashboardStats(userId: string) {
  const supabase = await createClient()
  const now = new Date()
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [todayRes, monthRes] = await Promise.all([
    supabase.from('audits').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', startOfDay),
    supabase.from('audits').select('id, total_errors', { count: 'exact' })
      .eq('user_id', userId).gte('created_at', startOfMonth),
  ])

  const totalErrors = (monthRes.data ?? []).reduce((acc, a) => acc + (a.total_errors || 0), 0)
  return { today: todayRes.count ?? 0, month: monthRes.count ?? 0, errors: totalErrors }
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

const STATS = [
  { key: 'today',  label: 'Auditorías hoy',          icon: SearchIcon,        color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { key: 'month',  label: 'Archivos este mes',        icon: BarChartIcon,      color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { key: 'errors', label: 'Errores detectados / mes', icon: AlertTriangleIcon, color: 'text-red-500',    bg: 'bg-red-50'    },
] as const

export default async function DashboardPage() {
  const sub = await getSubscriptionStatus()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const stats = user
    ? await getDashboardStats(user.id).catch(() => ({ today: 0, month: 0, errors: 0 }))
    : { today: 0, month: 0, errors: 0 }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-slate-400 font-medium">{greeting()}</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-0.5 tracking-tight">Panel de control</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {STATS.map(s => {
          const Icon = s.icon
          const value = stats[s.key]
          return (
            <div key={s.key} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{s.label}</p>
                  <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
                </div>
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={17} className={s.color} strokeWidth={2} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA principal */}
      <div className="bg-slate-900 rounded-xl p-6 mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white mb-1">Nueva auditoría RIPS</h2>
          <p className="text-slate-400 text-sm max-w-xl">
            Valida archivos JSON contra la Resolución 2275 de 2023 en segundos.
            {sub.plan === 'starter' && ' Hasta 10 MB por archivo.'}
            {sub.plan === 'pro'     && ' Hasta 50 MB por archivo.'}
          </p>
        </div>
        {sub.isActive ? (
          <Link
            href="/dashboard/audit"
            className="flex-shrink-0 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-500 transition whitespace-nowrap"
          >
            Iniciar auditoría
          </Link>
        ) : (
          <Link
            href="/dashboard/billing"
            className="flex-shrink-0 bg-white text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-100 transition whitespace-nowrap"
          >
            Activar plan
          </Link>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <ShieldIcon size={16} className="text-blue-600" strokeWidth={2} />
            <h3 className="text-sm font-semibold text-slate-900">Resolución 2275/2023</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Módulos AF, AT, AC, AM, AN y AU. Cobertura completa de la norma vigente.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <ZapIcon size={16} className="text-indigo-600" strokeWidth={2} />
            <h3 className="text-sm font-semibold text-slate-900">IA correctora</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Sugerencias automáticas para cada error. Menos tiempo de corrección manual.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <HistoryIcon size={16} className="text-slate-600" strokeWidth={2} />
            <h3 className="text-sm font-semibold text-slate-900">Historial completo</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Todas tus auditorías anteriores con resultados y reportes.
          </p>
          <Link href="/dashboard/history" className="text-xs text-blue-600 font-medium mt-2 inline-block hover:underline">
            Ver historial →
          </Link>
        </div>
      </div>
    </div>
  )
}
