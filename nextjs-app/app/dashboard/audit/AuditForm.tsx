'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auditRIPS } from '@/lib/api'
import type { SessionStatus } from '@/lib/api'
import type { Plan } from '@/lib/subscription'
import { UploadIcon, FileTextIcon, XIcon, SearchIcon, ShieldIcon, ZapIcon } from '@/components/ui/icons'

const MODULES = ['AF · Afiliados', 'AT · Atenciones', 'AC · Consultas', 'AM · Medicamentos', 'AN · Procedimientos', 'AU · Urgencias']

export default function AuditForm({ plan }: { plan: Plan | null }) {
  const router = useRouter()
  const [file, setFile]       = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]  = useState(false)
  const [error, setError]      = useState<string | null>(null)

  const maxMB    = plan === 'pro' ? 50 : 10
  const maxBytes = maxMB * 1024 * 1024

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    if (file.size > maxBytes) {
      setError(`Tu plan ${plan?.toUpperCase() ?? ''} permite archivos de máximo ${maxMB} MB.`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result: SessionStatus = await auditRIPS(file)
      router.push(`/dashboard/audit/results?id=${result.session_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo.')
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) { setFile(dropped); setError(null) }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] || null)
    setError(null)
  }

  const fileSizeStr = file
    ? file.size > 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`
    : null

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Nueva auditoría RIPS</h1>
        <p className="text-sm text-slate-500 mt-0.5">Resolución 2275 de 2023 · Archivos .json, .rips o .zip</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-4xl">

        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-4">
          <form onSubmit={handleSubmit}>
            {/* Drop zone */}
            <div
              onClick={() => !loading && document.getElementById('fileInput')?.click()}
              onDragOver={e => { e.preventDefault(); !loading && setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed transition-all select-none
                ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                ${dragging
                  ? 'border-blue-400 bg-blue-50'
                  : file
                    ? 'border-slate-300 bg-slate-50'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                }`}
            >
              {/* Loading overlay */}
              {loading && (
                <div className="absolute inset-0 rounded-xl bg-white/70 flex flex-col items-center justify-center gap-2 z-10">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-slate-600">Analizando archivo...</p>
                </div>
              )}

              <div className="p-10 text-center">
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                      <FileTextIcon size={22} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{fileSizeStr}</p>
                    </div>
                    {!loading && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setFile(null); setError(null) }}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition border border-slate-200 hover:border-red-200 rounded-full px-3 py-1"
                      >
                        <XIcon size={11} strokeWidth={2.5} />
                        Cambiar archivo
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      dragging ? 'bg-blue-100' : 'bg-slate-100'
                    }`}>
                      <UploadIcon size={22} className={dragging ? 'text-blue-600' : 'text-slate-400'} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {dragging ? 'Suelta el archivo aquí' : 'Arrastra o haz clic para seleccionar'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Archivos .json, .rips o .zip · máx. {maxMB} MB</p>
                    </div>
                  </div>
                )}
              </div>

              <input
                id="fileInput"
                type="file"
                accept=".json,.zip,.rips"
                className="hidden"
                disabled={loading}
                onChange={handleFileChange}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                <span className="font-bold flex-shrink-0 mt-0.5">!</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!file || loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold
                hover:bg-blue-700 active:bg-blue-800 transition
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SearchIcon size={16} strokeWidth={2} />
              {loading ? 'Analizando...' : 'Iniciar auditoría'}
            </button>
          </form>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Plan */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wide mb-2">Tu plan</p>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md ${
              plan === 'pro'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-100 text-slate-600'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${plan === 'pro' ? 'bg-blue-500' : 'bg-slate-400'}`} />
              {plan?.toUpperCase() ?? 'FREE'}
            </span>
            <p className="text-xs text-slate-500 mt-2">
              Máximo <span className="font-semibold">{maxMB} MB</span> por archivo
            </p>
          </div>

          {/* Módulos */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldIcon size={14} className="text-blue-600" strokeWidth={2} />
              <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wide">Módulos validados</p>
            </div>
            <ul className="space-y-1.5">
              {MODULES.map(m => (
                <li key={m} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  {m}
                </li>
              ))}
            </ul>
          </div>

          {/* Tiempo */}
          <div className="bg-slate-900 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ZapIcon size={14} className="text-blue-400" strokeWidth={2} />
              <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wide">Tiempo estimado</p>
            </div>
            <p className="text-2xl font-bold text-white">&lt; 5 s</p>
            <p className="text-xs text-slate-500 mt-0.5">por archivo de 10 MB</p>
          </div>
        </div>
      </div>
    </div>
  )
}
