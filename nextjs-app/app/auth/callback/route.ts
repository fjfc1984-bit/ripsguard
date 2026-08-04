import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function sendWelcomeEmail(email: string, orgName: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || apiKey === 're_REEMPLAZAR') return
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ripsguard.com'
  const nombre = (orgName || 'usuario').split(' ')[0]
  const auditUrl = APP_URL + '/dashboard/audit'
  const subj = 'Bienvenido a RIPS Guard — Tu prueba de 14 dias esta activa'

  const html = '<!DOCTYPE html>' +
    '<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Bienvenido a RIPS Guard</title></head>' +
    '<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">' +
    '<tr><td align="center">' +
    '<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">' +
    '<tr><td style="background:#2563eb;padding:28px 40px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td><div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;margin-right:10px;vertical-align:middle;">' +
    '<span style="color:#ffffff;font-size:12px;font-weight:800;">RG</span></div>' +
    '<span style="color:#ffffff;font-size:16px;font-weight:700;vertical-align:middle;">RIPS Guard</span></td>' +
    '</tr></table></td></tr>' +
    '<tr><td style="padding:40px 40px 32px;">' +
    '<h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0f172a;">Hola, ' + nombre + '!</h1>' +
    '<p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">' +
    'Tu cuenta en RIPS Guard est&aacute; lista. Tienes <strong>14 d&iacute;as de prueba gratuita</strong> ' +
    'para validar tus archivos RIPS JSON contra la <strong>Resoluci&oacute;n 2275 de 2023</strong>.</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:10px;padding:20px;margin-bottom:28px;">' +
    '<tr><td>' +
    '<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Qu&eacute; puedes hacer ahora</p>' +
    '<table cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;">' +
    '<span style="color:#22c55e;font-size:16px;margin-right:10px;">&#10003;</span>' +
    '<span style="font-size:14px;color:#334155;">Subir archivos RIPS JSON o ZIP</span></td></tr>' +
    '<tr><td style="padding:6px 0;">' +
    '<span style="color:#22c55e;font-size:16px;margin-right:10px;">&#10003;</span>' +
    '<span style="font-size:14px;color:#334155;">Detectar errores en todos los m&oacute;dulos AF, AT, AC, AM, AN y AU</span></td></tr>' +
    '<tr><td style="padding:6px 0;">' +
    '<span style="color:#22c55e;font-size:16px;margin-right:10px;">&#10003;</span>' +
    '<span style="font-size:14px;color:#334155;">Exportar reportes de errores para tu equipo</span></td></tr>' +
    '</table>' +
    '</td></tr></table>' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' +
    '<a href="' + auditUrl + '" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;' +
    'font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">Subir mi primer RIPS &rarr;</a>' +
    '</td></tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">' +
    '<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">' +
    'RIPS Guard &mdash; Hecho en Colombia &nbsp;&bull;&nbsp; ' +
    '<a href="' + APP_URL + '" style="color:#2563eb;text-decoration:none;">www.ripsguard.com</a></p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>'

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
    const cookieStore = await cookies()
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
                                   }import { NextResponse } from 'next/server'
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
