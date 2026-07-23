'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAuditById, type AuditResult } from '@/lib/api'

function ResultsContent() {
  const searchParams = useSearchParams()
  const auditId = searchParams.get('id')
  const [result, setResult] = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!auditId) {
      setLoading(false)
      return
    }
    getAuditById(auditId)
      .then(setResult)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [auditId])

  if (!auditId) {
    return (
      <div className="p-8">
        <p className="text-gray-500">
          No hay resultados.{' '}
          <Link href="/dashboard/audit" className="text-blue-600 hover:underline">
            Nueva auditoría
          </Link>
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-500">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Cargando resultados...
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error || 'No se encontró la auditoría'}
        </div>
        <Link href="/dashboard/audit" className="inline-block mt-4 text-blue-600 hover:underline text-sm">
          ← Nueva auditoría
        </Link>
      </div>
    )
  }

  const passed = result.total_errors === 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Resultados de Auditoría</h2>
        <Link href="/dashboard/audit" className="text-sm text-blue-600 hover:underline">
          + Nueva auditoría
        </Link>
      </div>

      <div className={`rounded-xl p-6 mb-6 ${passed
        ? 'bg-green-50 border border-green-200'
        : 'bg-red-50 border border-red-200'}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{passed ? '✅' : '❌'}</span>
          <h3 className={`text-xl font-bold ${passed ? 'text-green-800' : 'text-red-800'}`}>
            {passed ? 'Archivo válido' : 'Errores encontrados'}
          </h3>
        </div>
        <p className={passed ? 'text-green-700' : 'text-red-700'}>{result.summary}</p>
        <div className="flex gap-6 mt-4 text-sm">
          <span className="text-red-700 font-medium">❌ {result.total_errors} errores</span>
          <span className="text-yellow-700 font-medium">⚠️ {result.total_warnings} advertencias</span>
          <span className="text-gray-400 font-mono text-xs mt-0.5">ID: {result.audit_id}</span>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="space-y-3">
          {result.errors.map((err, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg">{err.severity === 'error' ? '❌' : '⚠️'}</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">[{err.code}] {err.message}</p>
                  {err.path && (
                    <p className="text-xs text-gray-400 mt-1 font-mono">{err.path}</p>
                  )}
                  {err.suggestion && (
                    <p className="text-xs text-blue-600 mt-2">💡 {err.suggestion}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex items-center gap-3 text-gray-500">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Cargando...
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
      }'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAuditById, type AuditResult } from '@/lib/api'

export default function ResultsPage() {
  const searchParams = useSearchParams()
  const auditId = searchParams.get('id')
  const [result, setResult] = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!auditId) {
      setLoading(false)
      return
    }
    getAuditById(auditId)
      .then(setResult)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [auditId])

  if (!auditId) {
    return (
      <div className="p-8">
        <p className="text-gray-500">
          No hay resultados.{' '}
          <Link href="/dashboard/audit" className="text-blue-600 hover:underline">
            Nueva auditoría
          </Link>
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-500">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Cargando resultados...
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error || 'No se encontró la auditoría'}
        </div>
        <Link href="/dashboard/audit" className="inline-block mt-4 text-blue-600 hover:underline text-sm">
          ← Nueva auditoría
        </Link>
      </div>
    )
  }

  const passed = result.total_errors === 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Resultados de Auditoría</h2>
        <Link href="/dashboard/audit" className="text-sm text-blue-600 hover:underline">
          + Nueva auditoría
        </Link>
      </div>

      {/* Summary card */}
      <div className={`rounded-xl p-6 mb-6 ${passed
        ? 'bg-green-50 border border-green-200'
        : 'bg-red-50 border border-red-200'}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{passed ? '✅' : '❌'}</span>
          <h3 className={`text-xl font-bold ${passed ? 'text-green-800' : 'text-red-800'}`}>
            {passed ? 'Archivo válido' : 'Errores encontrados'}
          </h3>
        </div>
        <p className={passed ? 'text-green-700' : 'text-red-700'}>{result.summary}</p>
        <div className="flex gap-6 mt-4 text-sm">
          <span className="text-red-700 font-medium">❌ {result.total_errors} errores</span>
          <span className="text-yellow-700 font-medium">⚠️ {result.total_warnings} advertencias</span>
          <span className="text-gray-400 font-mono text-xs mt-0.5">ID: {result.audit_id}</span>
        </div>
      </div>

      {/* Error list */}
      {result.errors.length > 0 && (
        <div className="space-y-3">
          {result.errors.map((err, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg">{err.severity === 'error' ? '❌' : '⚠️'}</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">[{err.code}] {err.message}</p>
                  {err.path && (
                    <p className="text-xs text-gray-400 mt-1 font-mono">{err.path}</p>
                  )}
                  {err.suggestion && (
                    <p className="text-xs text-blue-600 mt-2">💡 {err.suggestion}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
