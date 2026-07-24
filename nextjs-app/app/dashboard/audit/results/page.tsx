'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAuditById, type AuditResult } from '@/lib/api'

type ErrorItem = AuditResult['errors'][number]

function SeverityBadge({ severity }: { severity: string }) {
  return severity === 'error' ? (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
      ● Error
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      ● Advertencia
    </span>
  )
}

function ErrorCard({ err, index }: { err: ErrorItem; index: number }) {
  const [open, setOpen] = useState(index < 3) // Los primeros 3 abiertos por defecto

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition"
      >
        <span className="text-base flex-shrink-0">{err.severity === 'error' ? '❌' : '⚠️'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={err.severity} />
            <code className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{err.code}</code>
          </div>
          <p className="text-sm font-medium text-slate-900 mt-1 truncate">{err.message}</p>
        </div>
        <span className="text-slate-400 text-xs flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 space-y-3">
          {err.path && (
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Ruta</p>
              <code className="text-xs text-slate-600 font-mono bg-white border border-slate-200 rounded px-2 py-1 block break-all">
                {err.path}
              </code>
            </div>
          )}
          {err.suggestion && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <span className="text-sm flex-shrink-0">💡</span>
              <p className="text-sm text-blue-700">{err.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const auditId = searchParams.get('id')
  const [result, setResult] = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all')

  useEffect(() => {
    if (!auditId) { setLoading(false); return }
    getAuditById(auditId)
      .then(setResult)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [auditId])

  if (!auditId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl">📋</div>
        <p className="text-slate-500 text-sm">No hay resultados para mostrar.</p>
        <Link href="/dashboard/audit" className="text-blue-600 text-sm font-medium hover:underline">
          ← Nueva auditoría
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-slate-500">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Cargando resultados...
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          ⚠️ {error || 'No se encontró la auditoría'}
        </div>
        <Link href="/dashboard/audit" className="inline-block mt-4 text-blue-600 hover:underline text-sm">
          ← Nueva auditoría
        </Link>
      </div>
    )
  }

  const passed = result.total_errors === 0
  const errorsOnly = result.errors.filter(e => e.severity === 'error')
  const warningsOnly = result.errors.filter(e => e.severity !== 'error')
  const filtered = filterSeverity === 'all' ? result.errors
    : filterSeverity === 'error' ? errorsOnly : warningsOnly

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Resultados de Auditoría</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {result.audit_id}</p>
        </div>
        <Link
          href="/dashboard/audit"
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition shadow-sm"
        >
          + Nueva auditoría
        </Link>
      </div>

      {/* Summary card */}
      <div className={`rounded-2xl p-6 mb-6 ${passed
        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200'
        : 'bg-gradient-to-br from-red-50 to-rose-50 border border-red-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 ${
            passed ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {passed ? '✅' : '❌'}
          </div>
          <div className="flex-1">
            <h3 className={`text-xl font-bold ${passed ? 'text-green-800' : 'text-red-800'}`}>
              {passed ? 'Archivo válido — sin errores' : 'Errores detectados'}
            </h3>
            <p className={`text-sm mt-1 ${passed ? 'text-green-700' : 'text-red-700'}`}>
              {result.summary}
            </p>
            {/* Stats pills */}
            <div className="flex gap-3 mt-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-white border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                ❌ {result.total_errors} errores
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                ⚠️ {result.total_warnings} advertencias
              </span>
              {passed && (
                <span className="inline-flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                  ✓ Listo para enviar a la aseguradora
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error list */}
      {result.errors.length > 0 && (
        <div>
          {/* Filter tabs */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-semibold text-slate-700 mr-1">Filtrar:</span>
            {[
              { key: 'all', label: `Todo (${result.errors.length})` },
              { key: 'error', label: `Errores (${errorsOnly.length})` },
              { key: 'warning', label: `Advertencias (${warningsOnly.length})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterSeverity(tab.key as typeof filterSeverity)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                  filterSeverity === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map((err, i) => (
              <ErrorCard key={i} err={err} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex items-center gap-3 text-slate-500">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Cargando...
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}
