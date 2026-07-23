import Link from 'next/link'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: '🏠' },
  { href: '/dashboard/audit', label: 'Auditoría', icon: '🔍' },
  { href: '/dashboard/billing', label: 'Plan', icon: '💳' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">RIPS Guard</h1>
          <p className="text-xs text-gray-500 mt-1">Auditoría RIPS 2275/2023</p>
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
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
