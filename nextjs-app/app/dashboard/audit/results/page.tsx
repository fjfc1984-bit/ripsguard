'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  getAuditById,
  downloadReport,
  type AuditReportResponse,
  type FindingResponse,
} from '@/lib/api'
import {
  CheckCircleIcon, XCircleIcon, AlertTriangleIcon,
  ChevronDownIcon, ChevronUpIcon, SearchIcon, DownloadIcon,
} from '@/components/ui/icons'

// Estilos de impresión inyectados en el DOM (PDF via Ctrl+P / window.print)
const PRINT_STYLES = `
@media print {
  header, nav, [data-no-print], .no-print { display: none !important; }
  body { background: white !important; }
  .print-break { page-break-before: always; }
  .bg-slate-50\\/50 { background: #f8fafc !important; }
  button { display: none !important; }
  a[href]:after { content: none !important; }
}
`

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(value)
}

const SECCION_LABEL: Record<string, string> = {
  consultas:      'AC · Consultas',
  procedimientos: 'AN · Procedimientos',
  urgencias:      'AU · Urgencias',
  hospitalizacion:'AH · Hospitalización',
  medicamentos:   'AM · Medicamentos',
  afiliados:      'AF · Afiliados',
  atenciones:     'AT · Atenciones',
}

// ─────────────────────────────────────────────
// Componentes
// ─────────────────────────────────────────────

function SeverityBadge({ severidad }: { severidad: string }) {
  if (severidad === 'critico') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 uppercase tracking-wide">
        Crítico
      </span>
    )
  }
  if (severidad === 'advertencia') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
        Advertencia
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">
      Info
    </span>
  )
}

function FindingCard({ finding, index }: { finding: FindingResponse; index: number }) {
  const [open, setOpen] = useState(index < 5)
  const isCritical = finding.severidad === 'critico'

  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${
      isCritical ? 'border-red-200' : 'border-amber-200'
    }`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition"
      >
        <div className={`flex-shrink-0 ${isCritical ? 'text-red-500' : 'text-amber-500'}`}>
          {isCritical
            ? <XCircleIcon size={16} strokeWidth={2} />
            : <AlertTriangleIcon size={16} strokeWidth={2} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <SeverityBadge severidad={finding.severidad} />
            <code className="text-[11px] text-slate-400 font-mono">{finding.regla_codigo}</code>
            <span className="text-[11px] text-slate-400">
              {SECCION_LABEL[finding.seccion] ?? finding.seccion}
              {finding.numero_fila > 0 && ` · fila ${finding.numero_fila}`}
            </span>
          </div>
          <p className="text-sm text-slate-800 truncate">{finding.descripcion}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3">
          {finding.valor_en_riesgo > 0 && (
            <span className="text-xs font-semibold text-red-600 tabular-nums hidden sm:block">
              {formatCOP(finding.valor_en_riesgo)}
            </span>
          )}
          <span className="text-slate-400">
            {open ? <ChevronUpIcon size={15} strokeWidth={2} /> : <ChevronDownIcon size={15} strokeWidth={2} />}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-3.5 space-y-3 bg-slate-50/50">
          {/* Campo afectado */}
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1">Campo afectado</p>
            <code className="block text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded px-3 py-1.5 break-all">
              {finding.campo}
              {finding.valor_incorrecto != null && ` = "${finding.valor_incorrecto}"`}
            </code>
          </div>

          {/* Sugerencia IA */}
          {finding.sugerencia_ia && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wide mb-0.5">Sugerencia IA</p>
                <p className="text-xs text-blue-800">{finding.sugerencia_ia}</p>
              </div>
            </div>
          )}

          {/* Valor en riesgo mobile */}
          {finding.valor_en_riesgo > 0 && (
            <p className="text-xs text-slate-500 sm:hidden">
              Valor en riesgo: <span className="font-semibold text-red-600">{formatCOP(finding.valor_en_riesgo)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Contenido principal
// ─────────────────────────────────────────────

function ResultsContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('id')

  const [result, setResult]    = useState<AuditReportResponse | null>(null)
  const [loading, setLoading]  = useState(true)
  const [error, setError]      = useState<string | null>(null)
  const [filter, setFilter]    = useState<'all' | 'critico' | 'advertencia'>('all')
  const [downloading, setDown] = useState(false)

  // Inyectar estilos de impresión una sola vez
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = PRINT_STYLES
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  useEffect(() => {
    if (!sessionId) { setLoading(false); return }
    getAuditById(sessionId)
      .then(setResult)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 text-center min-h-64">
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
          <SearchIcon size={20} className="text-slate-400" />
        </div>
        <p className="text-slate-500 text-sm">Sin resultados para mostrar.</p>
        <Link href="/dashboard/audit" className="text-blue-600 text-sm font-medium hover:underline">
          ← Nueva auditoría
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-slate-400 text-sm">
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Cargando resultados...
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-red-700 text-sm">
          {error || 'No se encontró la auditoría.'}
        </div>
        <Link href="/dashboard/audit" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
          ← Nueva auditoría
        </Link>
      </div>
    )
  }

  const passed       = result.total_criticos === 0 && result.total_advertencias === 0
  const criticos     = result.findings.filter(f => f.severidad === 'critico')
  const advertencias = result.findings.filter(f => f.severidad === 'advertencia')
  const filtered     = filter === 'all'        ? result.findings
                     : filter === 'critico'    ? criticos
                     : advertencias

  async function handleDownload() {
    if (!sessionId) return
    setDown(true)
    try { await downloadReport(sessionId) }
    catch (e) { alert(e instanceof Error ? e.message : 'Error al descargar') }
    finally { setDown(false) }
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Resultados de auditoría</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {result.session_id.slice(0, 8)}…</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => window.print()}
            data-no-print
            className="flex items-center gap-1.5 border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 transition"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimir / PDF
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            data-no-print
            className="flex items-center gap-1.5 border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            <DownloadIcon size={14} strokeWidth={2} />
            {downloading ? 'Descargando…' : 'Descargar JSON'}
          </button>
          <Link
            href="/dashboard/audit"
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <SearchIcon size={14} strokeWidth={2} />
            Nueva auditoría
          </Link>
        </div>
      </div>

      {/* Resumen ejecutivo */}
      <div className={`rounded-xl border p-5 mb-5 ${
        passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 mt-0.5 ${passed ? 'text-green-600' : 'text-red-500'}`}>
            {passed
              ? <CheckCircleIcon size={22} strokeWidth={2} />
              : <XCircleIcon    size={22} strokeWidth={2} />}
          </div>
          <div className="flex-1">
            <h2 className={`text-base font-bold ${passed ? 'text-green-800' : 'text-red-800'}`}>
              {passed
                ? 'Archivo válido — sin errores ni advertencias'
                : `Se encontraron ${result.total_errores} hallazgo${result.total_errores !== 1 ? 's' : ''}`}
            </h2>
            <div className="flex flex-wrap gap-3 mt-3">
              <div className="flex items-center gap-1.5 bg-white border border-red-200 rounded-full px-3 py-1">
                <XCircleIcon size={12} strokeWidth={2.5} className="text-red-500" />
                <span className="text-xs font-semibold text-red-700">
                  {result.total_criticos} crítico{result.total_criticos !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-full px-3 py-1">
                <AlertTriangleIcon size={12} strokeWidth={2.5} className="text-amber-500" />
                <span className="text-xs font-semibold text-amber-700">
                  {result.total_advertencias} advertencia{result.total_advertencias !== 1 ? 's' : ''}
                </span>
              </div>
              {result.valor_en_riesgo > 0 && (
                <div className="flex items-center gap-1.5 bg-white border border-red-300 rounded-full px-3 py-1">
                  <span className="text-xs font-semibold text-red-700">
                    {formatCOP(result.valor_en_riesgo)} en riesgo ({result.porcentaje_riesgo.toFixed(1)}%)
                  </span>
                </div>
              )}
              {passed && (
                <div className="flex items-center gap-1.5 bg-green-600 rounded-full px-3 py-1">
                  <CheckCircleIcon size={12} strokeWidth={2.5} className="text-white" />
                  <span className="text-xs font-semibold text-white">Listo para enviar a la aseguradora</span>
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
          { label: 'Valor en riesgo', value: formatCOP(result.valor_en_riesgo),              sub: 'posible glosa', red: result.valor_en_riesgo > 0 },
          { label: 'Riesgo',          value: `${result.porcentaje_riesgo.toFixed(1)}%`,      sub: 'del total', red: result.porcentaje_riesgo > 5 },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wide mb-1">{m.label}</p>
            <p className={`text-lg font-bold tabular-nums ${m.red ? 'text-red-600' : 'text-slate-900'}`}>
              {m.value}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Resumen por sección */}
      {Object.keys(result.resumen_por_seccion).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Errores por sección</p>
          <div className="space-y-2">
            {Object.entries(result.resumen_por_seccion).map(([sec, data]) => (
              <div key={sec} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-slate-500 w-44 flex-shrink-0">
                  {SECCION_LABEL[sec] ?? sec}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  {data.criticos > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">
                      {data.criticos} crítico{data.criticos !== 1 ? 's' : ''}
                    </span>
                  )}
                  {data.advertencias > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                      {data.advertencias} advertencia{data.advertencias !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {data.valor_en_riesgo > 0 && (
                  <span className="text-xs font-semibold text-red-600 tabular-nums">
                    {formatCOP(data.valor_en_riesgo)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listado de hallazgos */}
      {result.findings.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1">Filtrar:</span>
            {([
              ['all',         `Todo (${result.findings.length})`],
              ['critico',     `Críticos (${criticos.length})`],
              ['advertencia', `Advertencias (${advertencias.length})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  filter === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map((finding, i) => (
              <FindingCard key={`${finding.regla_codigo}-${i}`} finding={finding} index={i} />
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              Sin hallazgos en esta categoría.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex items-center gap-3 text-slate-400 text-sm">
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Cargando...
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}
