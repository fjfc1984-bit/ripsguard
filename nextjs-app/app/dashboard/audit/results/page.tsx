'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAuditById, type AuditResult, type AuditError } from '@/lib/api'
import {
  CheckCircleIcon, XCircleIcon, AlertTriangleIcon,
  ChevronDownIcon, ChevronUpIcon, SearchIcon,
} from '@/components/ui/icons'

function SeverityBadge({ severity }: { severity: string }) {
  return severity === 'error' ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 uppercase tracking-wide">
      Error
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
      Advertencia
    </span>
  )
}

function ErrorCard({ err, index }: { err: AuditError; index: number }) {
  const [open, setOpen] = useState(index < 5)
  const isError = err.severity === 'error'

  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${isError ? 'border-red-200' : 'border-amber-200'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition"
      >
        <div className={`flex-shrink-0 ${isError ? 'text-red-500' : 'text-amber-500'}`}>
          {isError
            ? <XCircleIcon size={16} strokeWidth={2} />
            : <AlertTriangleIcon size={16} strokeWidth={2} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <SeverityBadge severity={err.severity} />
            <code className="text-[11px] text-slate-400 font-mono">{err.code}</code>
          </div>
          <p className="text-sm text-slate-800 truncate">{err.message}</p>
        </div>
        <div className="flex-shrink-0 text-slate-400">
          {open ? <ChevronUpIcon size={15} strokeWidth={2} /> : <ChevronDownIcon size={15} strokeWidth={2} />}
        </div>
      </button>

      {open && (err.path || err.suggestion) && (
        <div className="border-t border-slate-100 px-5 py-3.5 space-y-2.5 bg-slate-50/50">
          {err.path && (
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide mb-1">Ruta</p>
              <code className="block text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded px-3 py-1.5 break-all">
                {err.path}
              </code>
            </div>
          )}
          {err.suggestion && (
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <p className="text-xs text-blue-700">{err.suggestion}</p>
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
  const [result, setResult]   = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<'all' | 'error' | 'warning'>('all')

  useEffect(() => {
    if (!auditId) { setLoading(false); return }
    getAuditById(auditId)
      .then(setResult)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [auditId])

  if (!auditId) {
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

  const passed      = result.total_errors === 0
  const errorsOnly  = result.errors.filter(e => e.severity === 'error')
  const warningsOnly = result.errors.filter(e => e.severity !== 'error')
  const filtered    = filter === 'all' ? result.errors : filter === 'error' ? errorsOnly : warningsOnly

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Resultados de auditoría</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {result.audit_id}</p>
        </div>
        <Link
          href="/dashboard/audit"
          className="flex-shrink-0 flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <SearchIcon size={14} strokeWidth={2} />
          Nueva auditoría
        </Link>
      </div>

      {/* Summary */}
      <div className={`rounded-xl border p-5 mb-6 ${passed
        ? 'bg-green-50 border-green-200'
        : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 mt-0.5 ${passed ? 'text-green-600' : 'text-red-500'}`}>
            {passed
              ? <CheckCircleIcon size={22} strokeWidth={2} />
              : <XCircleIcon    size={22} strokeWidth={2} />
            }
          </div>
          <div className="flex-1">
            <h2 className={`text-base font-bold ${passed ? 'text-green-800' : 'text-red-800'}`}>
              {passed ? 'Archivo válido — sin errores' : 'Se encontraron errores'}
            </h2>
            <p className={`text-sm mt-1 ${passed ? 'text-green-700' : 'text-red-700'}`}>
              {result.summary}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white border border-red-200 text-red-700">
                <XCircleIcon size={12} strokeWidth={2.5} />
                {result.total_errors} errores
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white border border-amber-200 text-amber-700">
                <AlertTriangleIcon size={12} strokeWidth={2.5} />
                {result.total_warnings} advertencias
              </span>
              {passed && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-green-600 text-white">
                  <CheckCircleIcon size={12} strokeWidth={2.5} />
                  Listo para enviar a la aseguradora
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter + list */}
      {result.errors.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-semibold text-slate-500 mr-1">Filtrar:</span>
            {([
              ['all',     `Todo (${result.errors.length})`],
              ['error',   `Errores (${errorsOnly.length})`],
              ['warning', `Advertencias (${warningsOnly.length})`],
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
            {filtered.map((err, i) => (
              <ErrorCard key={i} err={err} index={i} />
            ))}
          </div>
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
