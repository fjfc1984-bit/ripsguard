import Link from 'next/link'
import { CheckIcon, ShieldIcon, ZapIcon, FileTextIcon, BarChartIcon } from '@/components/ui/icons'

const FEATURES = [
  {
    icon: ZapIcon,
    title: 'Validación instantánea',
    desc: 'Detecta errores en segundos sobre todos los módulos AF, AT, AC, AM, AN y AU de la Res. 2275/2023.',
  },
  {
    icon: ShieldIcon,
    title: 'IA correctora',
    desc: 'Sugerencias automáticas de corrección para cada error. Menos tiempo de corrección manual.',
  },
  {
    icon: BarChartIcon,
    title: 'Historial y reportes',
    desc: 'Consulta todas tus auditorías anteriores y exporta reportes detallados para tu equipo de facturación.',
  },
]

const PLANS = [
  {
    name: 'Starter',
    price: '149.000',
    highlight: false,
    features: [
      '50 auditorías por mes',
      'Archivos hasta 10 MB',
      'Validación completa Res. 2275/2023',
      'Historial de auditorías',
      'Soporte por email',
    ],
  },
  {
    name: 'Pro',
    price: '299.000',
    highlight: true,
    badge: 'Más popular',
    features: [
      'Auditorías ilimitadas',
      'Archivos hasta 50 MB',
      'IA correctora incluida',
      'Acceso a API REST',
      'Soporte prioritario',
      'Multi-usuario — 3 accesos',
    ],
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">RG</span>
            </div>
            <span className="font-bold text-slate-900 text-sm">RIPS Guard</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition px-3 py-1.5">
              Iniciar sesión
            </Link>
            <Link href="/register" className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-blue-700 transition">
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-100 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-8 uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Resolución 2275 de 2023 · RIPS Nueva Generación
        </div>
        <h1 className="text-5xl font-extrabold text-slate-900 mb-5 leading-tight tracking-tight">
          Auditoría RIPS sin errores,<br />
          <span className="text-blue-600">en segundos</span>
        </h1>
        <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto leading-relaxed">
          Valida archivos RIPS JSON al instante contra la norma vigente.
          Detecta errores antes de enviar a la aseguradora — ahorra glosas y tiempo.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/register"
            className="bg-blue-600 text-white px-7 py-3 rounded-lg font-bold hover:bg-blue-700 transition text-sm shadow-lg shadow-blue-200"
          >
            Empezar gratis — 14 días
          </Link>
          <Link
            href="/demo/results"
            className="bg-white text-slate-700 px-7 py-3 rounded-lg font-semibold border border-slate-200 hover:bg-slate-50 transition text-sm"
          >
            Ver demo en vivo
          </Link>
        </div>
        <p className="text-xs text-slate-400 mt-3">Sin tarjeta de crédito · Demo disponible sin registro</p>
      </section>

      {/* Stats bar */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="bg-slate-900 rounded-xl py-8 grid grid-cols-3 divide-x divide-slate-700">
          {[
            { value: '100%', label: 'Módulos Res. 2275/2023' },
            { value: '< 5 s', label: 'por archivo de 10 MB' },
            { value: 'Bold', label: 'Pagos seguros Colombia' },
          ].map(s => (
            <div key={s.label} className="text-center px-6">
              <p className="text-2xl font-extrabold text-white tabular-nums">{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-900">Por qué RIPS Guard</h2>
          <p className="text-slate-500 text-sm mt-2">Construido específicamente para el sistema de salud colombiano</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map(f => {
            const Icon = f.icon
            return (
              <div key={f.title} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                  <Icon size={18} className="text-blue-600" strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2 text-sm">{f.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-slate-50 border-y border-slate-200 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900">Precios transparentes</h2>
            <p className="text-slate-500 text-sm mt-2">IVA incluido · Pago mensual · Sin contratos</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={`bg-white rounded-xl border-2 p-6 ${
                  plan.highlight ? 'border-blue-600' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900">{plan.name}</h3>
                      {'badge' in plan && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                        COP {plan.price}
                      </span>
                      <span className="text-slate-400 text-sm">/mes</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <CheckIcon size={14} strokeWidth={2.5} className="text-green-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`block text-center py-2.5 rounded-lg text-sm font-bold transition ${
                    plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  Empezar 14 días gratis
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Los primeros 14 días son gratis sin tarjeta de crédito. Activa tu plan cuando estés listo.
          </p>
        </div>
      </section>

      {/* Footer mínimo */}
      <footer className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-[9px] font-bold">RG</span>
          </div>
          <span>RIPS Guard — Hecho en Colombia</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login"    className="hover:text-slate-600 transition">Iniciar sesión</Link>
          <Link href="/register" className="hover:text-slate-600 transition">Registro</Link>
        </div>
      </footer>
    </main>
  )
}
