import Link from 'next/link'
import { headers } from 'next/headers'
import { getSubscriptionStatus } from '@/lib/subscription'
import {
  HomeIcon, SearchIcon, HistoryIcon, CreditCardIcon, LogOutIcon,
} from '@/components/ui/icons'
import OnboardingBanner from '@/components/OnboardingBanner'

const navItems = [
  { href: '/dashboard',         label: 'Inicio',    icon: HomeIcon,       exact: true  },
  { href: '/dashboard/audit',   label: 'Auditoría', icon: SearchIcon,     exact: false },
  { href: '/dashboard/history', label: 'Historial', icon: HistoryIcon,    exact: false },
  { href: '/dashboard/billing', label: 'Plan',      icon: CreditCardIcon, exact: false },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sub = await getSubscriptionStatus()
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  const trialDaysLeft =
    sub.isActive && sub.estado === 'trial' && sub.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000))
      : null

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">

        {/* Logo */}
        <div className="h-14 px-5 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold tracking-tight">RG</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-tight">RIPS Guard</p>
            <p className="text-[10px] text-slate-400 leading-tight">Res. 2275/2023</p>
          </div>
        </div>

        {/* Plan badge */}
        {sub.plan && (
          <div className="px-4 pt-3 pb-1">
            <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md w-fit ${
              sub.plan === 'pro'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : sub.estado === 'trial'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-slate-100 text-slate-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                sub.plan === 'pro' ? 'bg-blue-500' : sub.estado === 'trial' ? 'bg-amber-500' : 'bg-slate-400'
              }`} />
              {sub.plan.toUpperCase()}{sub.estado === 'trial' ? ' · Trial' : ''}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const isActive = item.exact
              ? pathname === item.href || pathname === ''
              : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2 : 1.75}
                  className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer sidebar */}
        <div className="border-t border-slate-100 p-3 space-y-1">
          {sub.periodEndsAt && sub.isActive && (
            <p className="px-3 py-1 text-[11px] text-slate-400">
              Vence: {new Date(sub.periodEndsAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 text-left text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition px-3 py-2 rounded-lg group"
            >
              <LogOutIcon size={15} className="text-slate-400 group-hover:text-red-500" />
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {trialDaysLeft !== null && trialDaysLeft <= 7 && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-sm flex-shrink-0">
            <span className="text-amber-800 font-medium">
              Periodo de prueba vence en <strong>{trialDaysLeft} {trialDaysLeft === 1 ? 'día' : 'días'}</strong>
            </span>
            <Link href="/dashboard/billing" className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-md hover:bg-amber-200 transition">
              Activar plan
            </Link>
          </div>
        )}
        {!sub.isActive && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between text-sm flex-shrink-0">
            <span className="text-red-800 font-medium">
              Suscripción inactiva — auditorías deshabilitadas
            </span>
            <Link href="/dashboard/billing" className="text-xs font-semibold text-red-700 bg-red-100 border border-red-300 px-3 py-1 rounded-md hover:bg-red-200 transition">
              Activar plan
            </Link>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <OnboardingBanner />
          {children}
        </div>
      </main>
    </div>
  )
}
