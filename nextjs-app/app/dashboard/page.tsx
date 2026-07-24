import Link from 'next/link'
import { getSubscriptionStatus } from '@/lib/subscription'
import { createClient } from '@/lib/supabase/server'

async function getDashboardStats(userId: string) {
  const supabase = await createClient()
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [todayRes, monthRes] = await Promise.all([
    supabase.from('audits').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', startOfDay),
    supabase.from('audits').select('id, total_errors', { count: 'exact' })
      .eq('user_id', userId).gte('created_at', startOfMonth),
  ])

  const totalErrors = (monthRes.data ?? []).reduce((acc, a) => acc + (a.total_errors || 0), 0)

  return {
    today: todayRes.count ?? 0,
    month: monthRes.count ?? 0,
    errors: totalErrors,
  }
}

export default async function DashboardPage() {
  const sub = await getSubscriptionStatus()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const stats = user ? await getDashboardStats(user.id).catch(() => ({ today: 0, month: 0, errors: 0 }))
    : { today: 0, month: 0, errors: 0 }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-slate-500 text-sm font-medium">{greeting()}</p>
        <h2 className="text-2xl font-bold text-slate-900 mt-0.5">Panel de Control</h2>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Hoy</span>
            <span className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-lg">🔍</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.today}</div>
          <div className="text-sm text-slate-500 mt-1">Auditorías realizadas</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Este mes</span>
            <span className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-lg">📂</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.month}</div>
          <div className="text-sm text-slate-500 mt-1">Archivos procesados</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Errores</span>
            <span className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-lg">⚠️</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.errors}</div>
          <div className="text-sm text-slate-500 mt-1">Detectados este mes</div>
        </div>
      </div>

      {/* Main CTA */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-7 text-white mb-6 shadow-lg shadow-blue-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">🚀 Nueva Auditoría RIPS</h3>
            <p className="text-blue-100 text-sm max-w-md">
              Sube un archivo RIPS JSON y lo validamos contra la Resolución 2275 de 2023 en segundos.
              {sub.plan === 'starter' && ' Tu plan Starter permite hasta 10 MB.'}
              {sub.plan === 'pro' && ' Tu plan Pro permite hasta 50 MB.'}
            </p>
          </div>
          <span className="text-5xl opacity-20 ml-4">🔍</span>
        </div>
        {sub.isActive ? (
          <Link
            href="/dashboard/audit"
            className="inline-block mt-5 bg-white text-blue-700 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-50 transition shadow-sm"
          >
            Iniciar auditoría →
          </Link>
        ) : (
          <Link
            href="/dashboard/billing"
            className="inline-block mt-5 bg-white text-blue-700 px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-50 transition shadow-sm"
          >
            Activar plan para auditar →
          </Link>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-2xl mb-2">📋</div>
          <h4 className="font-semibold text-slate-900 mb-1 text-sm">Resolución 2275/2023</h4>
          <p className="text-slate-500 text-xs leading-relaxed">
            Validamos contra todos los módulos: AF, AT, AC, AM, AN, AU y contratos.
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-2xl mb-2">🤖</div>
          <h4 className="font-semibold text-slate-900 mb-1 text-sm">IA Correctora</h4>
          <p className="text-slate-500 text-xs leading-relaxed">
            Sugerencias automáticas de corrección con IA para cada error detectado.
          </p>
        </div>
      </div>
    </div>
  )
}
