'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'confirm'>('form')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { org_name: orgName },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (data.session) {
      window.location.href = '/dashboard'
    } else {
      setStep('confirm')
    }
  }

  async function handleResend() {
    setLoading(true)
    await supabase.auth.resend({ type: 'signup', email })
    setLoading(false)
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-8 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
              📧
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Revisa tu correo</h2>
            <p className="text-slate-500 text-sm mb-2">
              Enviamos un enlace de confirmación a:
            </p>
            <p className="font-semibold text-slate-800 text-sm mb-6 bg-slate-50 rounded-lg py-2 px-4">
              {email}
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 mb-6 text-left">
              💡 Haz clic en el enlace del correo para activar tu cuenta. Si no aparece en unos minutos, revisa <strong>spam</strong>.
            </div>
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              {loading ? 'Reenviando...' : 'Reenviar correo de confirmación'}
            </button>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link href="/login" className="text-sm text-slate-400 hover:text-slate-600">
                ← Volver al inicio de sesión
              </Link>
            </div>
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
          <h1 className="text-2xl font-bold text-slate-900">Crear cuenta gratis</h1>
          <p className="text-slate-500 text-sm mt-1">14 días de prueba · Sin tarjeta de crédito</p>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {['✅ Res. 2275/2023', '🔒 Datos seguros', '🇨🇴 Hecho en Colombia'].map(b => (
            <span key={b} className="text-xs text-slate-500 font-medium">{b}</span>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nombre de la IPS / Clínica
              </label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-400"
                placeholder="Clínica San Juan"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-400"
                placeholder="admin@clinica.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-400"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-blue-200 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando cuenta...
                </span>
              ) : 'Crear cuenta gratis →'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
