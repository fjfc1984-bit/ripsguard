import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-slate-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            RG
          </div>
          <span className="font-bold text-slate-900">RIPS Guard</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium px-3 py-1.5 transition">
            Iniciar sesión
          </Link>
          <Link href="/register" className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition">
            Empezar gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-100 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Resolución 2275 de 2023 — RIPS Nueva Generación
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight tracking-tight">
          Auditoría RIPS<br />
          <span className="text-blue-600">sin errores</span>
        </h1>
        <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          Valida archivos RIPS JSON al instante contra la Res. 2275/2023.
          Detecta errores antes de enviar a la aseguradora — ahorra glosas y tiempo.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/register"
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-200 text-sm"
          >
            Empezar gratis — 14 días →
          </Link>
          <Link
            href="/login"
            className="bg-white text-slate-700 px-8 py-3 rounded-xl font-semibold border border-slate-200 hover:bg-slate-50 transition text-sm"
          >
            Iniciar sesión
          </Link>
        </div>
        <p className="text-xs text-slate-400 mt-4">Sin tarjeta de crédito · Cancela cuando quieras</p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: '⚡',
              color: 'bg-amber-50 text-amber-600',
              title: 'Validación instantánea',
              desc: 'Detecta errores en segundos según todos los módulos de la Res. 2275/2023: AF, AT, AC, AM, AN, AU.',
            },
            {
              icon: '🤖',
              color: 'bg-blue-50 text-blue-600',
              title: 'IA correctora',
              desc: 'Sugerencias automáticas de corrección para cada error detectado. Menos tiempo corrigiendo manualmente.',
            },
            {
              icon: '📋',
              color: 'bg-green-50 text-green-600',
              title: 'Informes de auditoría',
              desc: 'Exporta reportes detallados para tu equipo de facturación y auditoría médica.',
            },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center text-xl mb-4`}>
                {f.icon}
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div className="mt-8 bg-slate-900 rounded-2xl p-8 grid grid-cols-3 gap-6 text-center">
          {[
            { value: '2275', label: 'Resolución 2023', suffix: '' },
            { value: '< 5', label: 'segundos por archivo', suffix: 's' },
            { value: '99', label: 'validaciones cubiertas', suffix: '%' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-white">{s.value}<span className="text-blue-400">{s.suffix}</span></div>
              <div className="text-slate-400 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
