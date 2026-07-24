import Link from 'next/link'
import { headers } from 'next/headers'
import { getSubscriptionStatus } from '@/lib/subscription'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠', exact: true },
  { href: '/dashboard/audit', label: 'Auditoría', icon: '🔍', exact: false },
  { href: '/dashboard/billing', label: 'Plan', icon: '💳', exact: false },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sub = await getSubscriptionStatus()
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  const trialDaysLeft =
    sub.isActive && sub.estado === 'trial' && sub.trialEndsAt
      ? Math.max(0, Math.ceil(
          (new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000
        ))
      : null

  const planColor = sub.plan === 'pro'
    ? 'bg-blue-600 text-white'
    : sub.estado === 'trial'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-600'

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        {/* Logo */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
              RG
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">RIPS Guard</h1>
              <p className="text-xs text-slate-400">Res. 2275/2023</p>
            </div>
          </div>
          {sub.plan && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold ${planColor}`}>
              {sub.plan === 'pro' ? '⚡' : '🌱'}
              {sub.plan.toUpperCase()}{sub.estado === 'trial' ? ' · Trial' : ''}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => {
            const isActive = item.exact
              ? pathname === item.href || pathname === ''
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer sidebar */}
        <div className="p-3 border-t border-slate-100 space-y-1">
          {sub.periodEndsAt && sub.isActive && (
            <div className="px-3 py-2 text-xs text-slate-400">
              Vence: {new Date(sub.periodEndsAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            </div>
          )}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-3 text-left text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 transition px-3 py-2 rounded-lg"
            >
              <span>🚪</span>
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Banners */}
        {trialDaysLeft !== null && trialDaysLeft <= 7 && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-sm">
            <span className="text-amber-800 font-medium">
              ⏳ Trial vence en <strong>{trialDaysLeft} días</strong>
            </span>
            <Link href="/dashboard/billing" className="text-amber-700 font-semibold hover:underline text-xs bg-amber-100 px-3 py-1 rounded-full">
              Activar plan →
            </Link>
          </div>
        )}
        {!sub.isActive && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center justify-between text-sm">
            <span className="text-red-800 font-medium">
              ⚠️ Suscripción inactiva — auditorías deshabilitadas
            </span>
            <Link href="/dashboard/billing" className="text-red-700 font-semibold hover:underline text-xs bg-red-100 px-3 py-1 rounded-full">
              Activar plan →
            </Link>
          </div>
        )}

        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
