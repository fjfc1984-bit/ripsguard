import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Bienvenido a RIPS Guard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Auditorías hoy', value: '0', icon: '🔍' },
          { label: 'Archivos este mes', value: '0', icon: '📂' },
          { label: 'Errores detectados', value: '0', icon: '⚠️' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">🚀 Empieza tu primera auditoría</h3>
        <p className="text-blue-700 text-sm mb-4">
          Sube un archivo RIPS JSON y lo validamos contra la Resolución 2275 de 2023.
        </p>
        <Link
          href="/dashboard/audit"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          Nueva auditoría
        </Link>
      </div>
    </div>
  )
}
