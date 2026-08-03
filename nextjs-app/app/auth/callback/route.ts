import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function sendWelcomeEmail(email: string, orgName: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || apiKey === 're_REEMPLAZAR') return
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ripsguard.com'
  const nombre = (orgName || 'usuario').split(' ')[0]
  const subj = 'Bienvenido a RIPS Guard, ' + nombre + '! Tu trial de 14 dias esta activo'
  const html = '<h1>Bienvenido ' + nombre + '</h1><p>Tu cuenta RIPS Guard esta lista.</p><a href="' + APP_URL + '/dashboard/audit">Subir primer RIPS</a>'
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'RIPS Guard <no-reply@ripsguard.com>', to: [email], subject: subj, html }),
  })
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  if (code) {
    const cookieStore = await cookies() // fix: await required in Next.js 14.2+
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email && user.confirmed_at) {
      const ms = Date.now() - new Date(user.confirmed_at).getTime()
      if (ms < 60000) {
        const org = (user.user_metadata?.org_name as string | undefined) ?? ''
        sendWelcomeEmail(user.email, org).catch(e => console.error('[welcome]', e))
      }
    }
  }
  return NextResponse.redirect(origin + '/dashboard')
      }
