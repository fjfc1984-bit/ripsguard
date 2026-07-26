'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getDemoReport, type AuditReportResponse, type FindingResponse } from '@/lib/api'
import {
  CheckCircleIcon, XCircleIcon, AlertTriangleIcon,
  ChevronDownIcon, ChevronUpIcon, ShieldIcon,
} from '@/components/ui/icons'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

const SECCION_LABEL: Record<string, string> = {
  consultas: 'AC · Consultas', procedimientos: 'AN · Procedimientos',
  urgencias: 'AU · Urgencias', hospitalizacion: 'AH · Hospitalización',
  medicamentos: 'AM · Medicamentos', afiliados: 'AF · Afiliados', atenciones: 'AT · Atenciones',
}

// ─────────────────────────────────────────────
// Componentes
// ─────────────────────────────────────────────
function SeverityBadge({ s }: { s: string }) {
  if (s === 'critico')     return <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 uppercase">Crítico</span>
  if (s === 'advertencia') return <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">Advertencia</span>
  return <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">Info</span>
}

function FindingCard({ f, i }: { f: FindingResponse; i: number }) {
  const [open, setOpen] = useState(i < 3)
  const crit = f.severidad === 'critico'
  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${crit ? 'border-red-200' : 'border-amber-200'}`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition">
        <div className={`flex-shrink-0 ${crit ? 'text-red-500' : 'text-amber-500'}`}>
          {crit ? <XCircleIcon size={16} strokeWidth={2}/> : <AlertTriangleIcon size={16} strokeWidth={2}/>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <SeverityBadge s={f.severidad}/>
            <code className="text-[11px] text-slate-400 font-mono">{f.regla_codigo}</code>
            <span className="text-[11px] text-slate-400">
              {SECCION_LABEL[f.seccion] ?? f.seccion}{f.numero_fila > 0 && ` · fila ${f.numero_fila}`}
            </span>
          </div>
          <p className="text-sm text-slate-800 truncate">{f.descripcion}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3">
          {f.valor_en_riesgo > 0 && (
            <span className="text-xs font-semibold text-red-600 tabular-nums hidden sm:block">{formatCOP(f.valor_en_riesgo)}</span>
          )}
          <span className="text-slate-400">{open ? <ChevronUpIcon size={15}/> : <ChevronDownIcon size={15}/>}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-3.5 space-y-3 bg-slate-50/50">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1">Campo afectado</p>
            <code className="block text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded px-3 py-1.5 break-all">
              {f.campo}{f.valor_incorrecto != null && ` = "${f.valor_incorrecto}"`}
            </code>
          </div>
          {f.sugerencia_ia && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wide mb-0.5">Sugerencia IA</p>
                <p className="text-xs text-blue-800">{f.sugerencia_ia}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Página demo
// ─────────────────────────────────────────────
export default function DemoResultsPage() {
  const [result, setResult] = useState<AuditReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'critico' | 'advertencia'>('all')

  useEffect(() => {
    getDemoReport().then(setResult).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Banner demo */}
      <div className="bg-blue-600 text-white text-center py-2.5 text-sm font-medium">
        Modo demo — datos ficticios de Clínica Medisalud S.A.S. &nbsp;·&nbsp;
        <Link href="/register" className="underline font-semibold hover:no-underline">
          Crear cuenta gratis para auditar tus archivos reales
        </Link>
      </div>

      {/* Nav mínimo */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">RG</span>
            </div>
            <span className="font-bold text-slate-900 text-sm">RIPS Guard</span>
          </Link>
          <Link href="/register"
            className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            Crear cuenta gratis
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
            Generando reporte demo...
          </div>
        )}

        {result && (
          <>
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reporte de auditoría RIPS</h1>
              <p className="text-xs text-slate-400 mt-0.5">Clínica Medisalud S.A.S. · Archivo demo · Res. 2275/2023</p>
            </div>

            {/* Resumen */}
            <div className="rounded-xl border bg-red-50 border-red-200 p-5 mb-5">
              <div className="flex items-start gap-4">
                <XCircleIcon size={22} strokeWidth={2} className="text-red-500 flex-shrink-0 mt-0.5"/>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-red-800">
                    Se encontraron {result.total_errores} hallazgo{result.total_errores !== 1 ? 's' : ''}
                  </h2>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <div className="flex items-center gap-1.5 bg-white border border-red-200 rounded-full px-3 py-1">
                      <XCircleIcon size={12} strokeWidth={2.5} className="text-red-500"/>
                      <span className="text-xs font-semibold text-red-700">{result.total_criticos} crítico{result.total_criticos !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-full px-3 py-1">
                      <AlertTriangleIcon size={12} strokeWidth={2.5} className="text-amber-500"/>
                      <span className="text-xs font-semibold text-amber-700">{result.total_advertencias} advertencia{result.total_advertencias !== 1 ? 's' : ''}</span>
                    </div>
                    {result.valor_en_riesgo > 0 && (
                      <div className="flex items-center gap-1.5 bg-white border border-red-300 rounded-full px-3 py-1">
                        <span className="text-xs font-semibold text-red-700">
                          {formatCOP(result.valor_en_riesgo)} en riesgo ({result.porcentaje_riesgo.toFixed(1)}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Registros',       value: result.total_registros.toLocaleString('es-CO'), sub: 'auditados' },
                { label: 'Valor facturado', value: formatCOP(result.valor_total),                  sub: 'total' },
                { label: 'Valor en riesgo', value: formatCOP(result.valor_en_riesgo),              sub: 'posible glosa', red: true },
                { label: 'Riesgo',          value: `${result.porcentaje_riesgo.toFixed(1)}%`,      sub: 'del total', red: result.porcentaje_riesgo > 5 },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wide mb-1">{m.label}</p>
                  <p className={`text-lg font-bold tabular-nums ${m.red ? 'text-red-600' : 'text-slate-900'}`}>{m.value}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{m.sub}</p>
                </div>
              ))}
            </div>

            {/* Hallazgos */}
            {result.findings.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 mr-1">Filtrar:</span>
                  {([
                    ['all',         `Todo (${result.findings.length})`],
                    ['critico',     `Críticos (${result.findings.filter(f => f.severidad === 'critico').length})`],
                    ['advertencia', `Advertencias (${result.findings.filter(f => f.severidad === 'advertencia').length})`],
                  ] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setFilter(key)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                        filter === key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {result.findings
                    .filter(f => filter === 'all' || f.severidad === filter)
                    .map((f, i) => <FindingCard key={i} f={f} i={i}/>)
                  }
                </div>
              </>
            )}

            {/* CTA */}
            <div className="mt-8 bg-slate-900 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldIcon size={16} className="text-blue-400" strokeWidth={2}/>
                  <h3 className="text-white font-bold">¿Tienes archivos RIPS propios?</h3>
                </div>
                <p className="text-slate-400 text-sm">Crea una cuenta gratis y audita tus archivos reales en segundos.</p>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <Link href="/login" className="border border-slate-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition">
                  Iniciar sesión
                </Link>
                <Link href="/register" className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition">
                  Crear cuenta gratis
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
