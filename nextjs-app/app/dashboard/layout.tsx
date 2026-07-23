import Link from 'next/link'
import { getSubscriptionStatus } from '@/lib/subscription'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/dashboard/audit', label: 'Auditoría', icon: '🔍' },
  { href: '/dashboard/billing', label: 'Plan', icon: '💳' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sub = await getSubscriptionStatus()

  const trialDaysLeft =
    sub.isActive && sub.estado === 'trial' && sub.trialEndsAt
      ? Math.max(0, Math.ceil(
          (new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000
        ))
      : null

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">RIPS Guard</h1>
          <p className="text-xs text-gray-500 mt-1">Auditoría RIPS 2275/2023</p>
          {sub.plan && (
            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${
              sub.plan === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {sub.plan.toUpperCase()}{sub.estado === 'trial' ? ' · Trial' : ''}
            </span>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition text-sm"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full text-left text-sm text-gray-500 hover:text-red-500 transition px-3 py-2"
            >
              🚪 Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Banner: trial por vencer */}
        {trialDaysLeft !== null && trialDaysLeft <= 7 && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-sm">
            <span className="text-amber-800">
              ⏳ Trial vence en <strong>{trialDaysLeft} días</strong>
            </span>
            <Link href="/dashboard/billing" className="text-amber-700 font-semibold hover:underline text-xs">
              Activar plan →
            </Link>
          </div>
        )}

        {/* Banner: suscripción inactiva */}
        {!sub.isActive && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between text-sm">
            <span className="text-red-800">
              ⚠️ Suscripción inactiva — auditorías deshabilitadas
            </span>
            <Link href="/dashboard/billing" className="text-red-700 font-semibold hover:underline text-xs">
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
