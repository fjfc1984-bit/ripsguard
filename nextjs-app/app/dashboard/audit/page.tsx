'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auditRIPS } from '@/lib/api'

export default function AuditPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await auditRIPS(file)
      // Store result and navigate
      sessionStorage.setItem('auditResult', JSON.stringify(result))
      router.push('/dashboard/audit/results')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Nueva Auditoría</h2>
      <p className="text-gray-500 mb-8">
        Sube tu archivo RIPS JSON (Resolución 2275 de 2023)
      </p>

      <form onSubmit={handleSubmit}>
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 transition cursor-pointer"
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <div className="text-4xl mb-4">📂</div>
          {file ? (
            <div>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600">Arrastra tu archivo RIPS aqui</p>
              <p className="text-sm text-gray-400 mt-1">JSON .rips</p>
            </div>
          )}
          <input
            id="fileInput"
            type="file"
            accept=".json,.rips"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || loading}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
        >
          {loading ? 'Analizando...' : 'Iniciar Auditoría'}
        </button>
      </form>
    </div>
  )
}
