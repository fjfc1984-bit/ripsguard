'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAuditHistory } from '@/lib/api'
import {
  HistoryIcon, CheckCircleIcon, XCircleIcon,
  AlertTriangleIcon, ChevronDownIcon, ChevronUpIcon, RefreshIcon,
} from '@/components/ui/icons'

interface AuditItem {
  audit_id: string
  status: 'valid' | 'invalid' | 'error'
  total_errors: number
  total_warnings: number
  summary: string
  processed_at: string
  filename?: string
}

interface HistoryResponse {
  audits: AuditItem[]
  total: number
  page: number
  page_size: number
}

function StatusBadge({ status, errors }: { status: string; errors: number }) {
  if (status === 'valid' || errors === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-700 uppercase tracking-wide">
        <CheckCircleIcon size={11} strokeWidth={2.5} /> Válido
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 uppercase tracking-wide">
      <XCircleIcon size={11} strokeWidth={2.5} /> Con errores
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function HistoryPage() {
  const [data, setData]         = useState<HistoryResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [page, setPage]         = useState(1)
  const [sortAsc, setSortAsc]   = useState(false)
  const PAGE_SIZE = 15

  async function load(p: number) {
    setLoading(true)
    setError(null)
    try {
      const result = await getAuditHistory(p, PAGE_SIZE)
      setData(result)
      setPage(p)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando historial.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [])

  const audits = data?.audits ?? []
  const sorted = [...audits].sort((a, b) => {
    const diff = new Date(a.processed_at).getTime() - new Date(b.processed_at).getTime()
    return sortAsc ? diff : -diff
  })
  const total     = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-7 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Historial de auditorías</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total > 0 ? `${total} auditoría${total !== 1 ? 's' : ''} en total` : 'Sin auditorías aún'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(page)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 bg-white px-3 py-2 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshIcon size={13} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <Link
            href="/dashboard/audit"
            className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Nueva auditoría
          </Link>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 text-slate-400 text-sm py-12 justify-center">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Cargando historial...
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && audits.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center">
            <HistoryIcon size={24} className="text-slate-400" strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-semibold text-slate-700">Sin auditorías aún</p>
            <p className="text-sm text-slate-400 mt-1">Las auditorías que realices aparecerán aquí.</p>
          </div>
          <Link
            href="/dashboard/audit"
            className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            Crear primera auditoría
          </Link>
        </div>
      )}

      {/* Table */}
      {!loading && !error && sorted.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Archivo / ID
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Estado
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Errores
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Advertencias
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => setSortAsc(s => !s)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800 transition"
                    >
                      Fecha
                      {sortAsc
                        ? <ChevronUpIcon size={12} strokeWidth={2.5} />
                        : <ChevronDownIcon size={12} strokeWidth={2.5} />
                      }
                    </button>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(audit => (
                  <tr key={audit.audit_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      {audit.filename ? (
                        <p className="font-medium text-slate-800 text-sm">{audit.filename}</p>
                      ) : null}
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{audit.audit_id}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={audit.status} errors={audit.total_errors} />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {audit.total_errors > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                          <XCircleIcon size={13} strokeWidth={2.5} />
                          {audit.total_errors}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 font-semibold">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {audit.total_warnings > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <AlertTriangleIcon size={13} strokeWidth={2.5} />
                          {audit.total_warnings}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 font-semibold">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-slate-500">{formatDate(audit.processed_at)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/dashboard/audit/results?id=${audit.audit_id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                      >
                        Ver resultados →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-400">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => load(page - 1)}
                  disabled={page <= 1 || loading}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-500">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => load(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
