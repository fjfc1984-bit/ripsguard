'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface AuditResult {
  audit_id: string
  status: string
  total_errors: number
  total_warnings: number
  errors: Array<{ code: string; message: string; severity: string; path?: string }>
  summary: string
}

export default function ResultsPage() {
  const [result, setResult] = useState<AuditResult | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('auditResult')
    if (stored) setResult(JSON.parse(stored))
  }, [])

  if (!result) {
    return (
      <div className="p-8">
        <p className="text-gray-500">No hay resultados. <Link href="/dashboard/audit" className="text-blue-600">Nueva auditoría</Link></p>
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
      <div className={`rounded-xl p-6 mb-6 ${passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
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
        </div>
      </div>

      {/* Error list */}
      {result.errors.length > 0 && (
        <div className="space-y-3">
          {result.errors.map((err, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg">{err.severity === 'error' ? '❌' : '⚠️'}</span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">[{err.code}] {err.message}</p>
                  {err.path && <p className="text-xs text-gray-400 mt-1">{err.path}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
