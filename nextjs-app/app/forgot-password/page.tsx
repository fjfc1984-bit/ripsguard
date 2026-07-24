'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { MailIcon, ShieldIcon } from '@/components/ui/icons'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-8 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <MailIcon size={26} className="text-blue-600" strokeWidth={1.75} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Revisa tu correo</h2>
            <p className="text-slate-500 text-sm mb-2">
              Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.
            </p>
            <p className="font-semibold text-slate-800 text-sm mb-6 bg-slate-50 rounded-lg py-2 px-4">
              {email}
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 mb-6 text-left">
              El enlace expira en 1 hora. Si no ves el correo, revisa tu carpeta de spam.
            </div>
            <Link href="/login" className="text-sm text-blue-600 hover:underline font-medium">
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl text-white font-bold text-lg mb-4 shadow-lg shadow-blue-200">
            RG
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Recuperar contraseña</h1>
          <p className="text-slate-500 text-sm mt-1">Te enviaremos un enlace para restablecerla</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email de tu cuenta
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-400"
                placeholder="admin@clinica.com"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                <ShieldIcon size={15} className="mt-0.5 flex-shrink-0" strokeWidth={2} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </span>
              ) : 'Enviar enlace de recuperación'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            ← Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
