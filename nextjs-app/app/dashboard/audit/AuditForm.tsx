'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auditRIPS } from '@/lib/api'
import type { Plan } from '@/lib/subscription'

export default function AuditForm({ plan }: { plan: Plan | null }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Límite de tamaño por plan
  const maxMB = plan === 'pro' ? 50 : 10
  const maxBytes = maxMB * 1024 * 1024

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    if (file.size > maxBytes) {
      setError(`Tu plan ${plan?.toUpperCase() ?? ''} permite archivos de máximo ${maxMB} MB`)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await auditRIPS(file)
      router.push(`/dashboard/audit/results?id=${result.audit_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo')
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Nueva Auditoría</h2>
      <p className="text-gray-500 mb-8">
        Sube tu archivo RIPS JSON (Resolución 2275 de 2023)
      </p>

      <form onSubmit={handleSubmit}>
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition cursor-pointer ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
          }`}
          onClick={() => document.getElementById('fileInput')?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="text-4xl mb-4">📂</div>
          {file ? (
            <div>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                className="text-xs text-red-500 mt-2 hover:underline"
              >
                Cambiar archivo
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600">Arrastra o haz clic para seleccionar</p>
              <p className="text-sm text-gray-400 mt-1">.json / .rips (máx. {maxMB} MB)</p>
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
