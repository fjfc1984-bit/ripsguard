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
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

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
    // Simular progreso visual
    const interval = setInterval(() => setProgress(p => Math.min(p + 8, 85)), 300)
    try {
      const result = await auditRIPS(file)
      clearInterval(interval)
      setProgress(100)
      setTimeout(() => router.push(`/dashboard/audit/results?id=${result.audit_id}`), 300)
    } catch (err: unknown) {
      clearInterval(interval)
      setProgress(0)
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo')
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) { setFile(dropped); setError(null) }
  }

  const fileSizeStr = file
    ? file.size > 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`
    : null

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Nueva Auditoría RIPS</h2>
        <p className="text-slate-500 text-sm mt-1">Validación automática según Resolución 2275 de 2023</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload zone — columna principal */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit}>
            {/* Drop zone */}
            <div
              onClick={() => !loading && document.getElementById('fileInput')?.click()}
              onDragOver={e => { e.preventDefault(); !loading && setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
                ${loading ? 'cursor-not-allowed opacity-75' : ''}
                ${dragging ? 'border-blue-400 bg-blue-50 scale-[1.01]' : file
                  ? 'border-blue-300 bg-blue-50/50'
                  : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30'
                }`}
            >
              {/* Progress bar */}
              {loading && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <div className="p-10 text-center">
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl">
                      📄
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{fileSizeStr}</p>
                    </div>
                    {!loading && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setFile(null); setError(null) }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 rounded-full px-3 py-1 hover:bg-red-50 transition"
                      >
                        Cambiar archivo
                      </button>
                    )}
                    {loading && (
                      <p className="text-xs text-blue-600 font-medium animate-pulse">
                        Analizando... {progress}%
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform ${dragging ? 'scale-110' : ''} bg-slate-100`}>
                      {dragging ? '📂' : '⬆️'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">
                        {dragging ? 'Suelta aquí el archivo' : 'Arrastra o haz clic para seleccionar'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Archivos .json o .rips — máx. {maxMB} MB</p>
                    </div>
                  </div>
                )}
              </div>

              <input
                id="fileInput"
                type="file"
                accept=".json,.rips"
                className="hidden"
                disabled={loading}
                onChange={e => { setFile(e.target.files?.[0] || null); setError(null) }}
              />
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                <span>⚠️</span> <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!file || loading}
              className="mt-5 w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold
                hover:bg-blue-700 active:bg-blue-800 transition
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-md shadow-blue-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analizando archivo...
                </span>
              ) : '🔍 Iniciar auditoría →'}
            </button>
          </form>
        </div>

        {/* Info sidebar */}
        <div className="space-y-4">
          {/* Plan actual */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide mb-2">Tu plan</p>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                plan === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {plan?.toUpperCase() ?? 'FREE'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Máximo <strong>{maxMB} MB</strong> por archivo
            </p>
          </div>

          {/* Qué valida */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide mb-3">Módulos validados</p>
            <div className="space-y-1.5">
              {['AF · Afiliados', 'AT · Atenciones', 'AC · Consultas', 'AM · Medicamentos', 'AN · Procedimientos', 'AU · Urgencias'].map(m => (
                <div key={m} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  {m}
                </div>
              ))}
            </div>
          </div>

          {/* Tiempo estimado */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-4">
            <p className="text-xs text-blue-600 font-semibold mb-1">⚡ Tiempo estimado</p>
            <p className="text-2xl font-bold text-slate-900">&lt; 5s</p>
            <p className="text-xs text-slate-500 mt-0.5">por archivo de 10 MB</p>
          </div>
        </div>
      </div>
    </div>
  )
}
