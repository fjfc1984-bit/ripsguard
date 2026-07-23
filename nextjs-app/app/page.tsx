import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
          <span>✅</span>
          <span>Resolución 2275 de 2023 - RIPS Nueva Generación</span>
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          RIPS Guard
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Valida y audita archivos RIPS JSON al instante.
          Detecta errores antes de enviar a la aseguradora.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/register"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Empezar gratis
          </Link>
          <Link
            href="/login"
            className="bg-white text-gray-700 px-8 py-3 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition"
          >
            Iniciar sesión
          </Link>
        </div>
        <div className="mt-20 grid grid-cols-3 gap-8 text-left">
          {[
            { icon: '🔍', title: 'Validación instantánea', desc: 'Detecta errores en segundos según la norma.' },
            { icon: '🤖', title: 'IA correctora', desc: 'Sugerencias de corrección con IA integrada.' },
            { icon: '📋', title: 'Informes PDF', desc: 'Exporta reportes de auditoría para tu equipo.' },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
