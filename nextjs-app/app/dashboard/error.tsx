'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="p-8 flex items-center justify-center min-h-96">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Error en el dashboard
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {error.message || 'Ocurrió un error inesperado.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Intentar de nuevo
          </button>
          <Link
            href="/dashboard"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            Ir al inicio
          </Link>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-400 mt-4 font-mono">
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
