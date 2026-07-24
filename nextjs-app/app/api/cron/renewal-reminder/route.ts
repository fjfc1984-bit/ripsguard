/**
 * Cron job: Recordatorio de renovación de suscripción
 *
 * Ejecutado diariamente por Vercel Cron (10am UTC = 7am Colombia).
 * Busca suscripciones que vencen en los próximos 3 días y envía
 * un email de recordatorio via Resend.
 *
 * Configuración en vercel.json:
 *   { "path": "/api/cron/renewal-reminder", "schedule": "0 10 * * *" }
 *
 * Variable de entorno requerida: CRON_SECRET
 */

import { NextResponse } from 'next/server'
import { createClient }  from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function sendRenewalEmail(to: string, planName: string, daysLeft: number, renewUrl: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'RIPS Guard <no-reply@ripsguard.com>',
      to:      [to],
      subject: daysLeft === 1
        ? '⚠️ Tu plan RIPS Guard vence mañana'
        : `Tu plan RIPS Guard vence en ${daysLeft} días`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#1e293b;padding:24px 32px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:32px;height:32px;background:#2563eb;border-radius:6px;text-align:center;vertical-align:middle;">
                <span style="color:#ffffff;font-weight:bold;font-size:13px;line-height:32px;">RG</span>
              </td>
              <td style="padding-left:10px;">
                <span style="color:#ffffff;font-weight:700;font-size:15px;">RIPS Guard</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">
            ${daysLeft === 1 ? 'Tu plan vence mañana' : `Tu plan vence en ${daysLeft} días`}
          </h1>
          <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
            Tu plan <strong>${planName.toUpperCase()}</strong> vence en
            <strong>${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}</strong>.
            Renueva ahora para no perder acceso a tus auditorías RIPS.
          </p>

          <!-- Warning box -->
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="margin:0;color:#92400e;font-size:13px;font-weight:600;">
              Si no renuevas, las auditorías quedarán deshabilitadas al vencer el plan.
            </p>
          </div>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#2563eb;border-radius:8px;">
              <a href="${renewUrl}"
                 style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">
                Renovar plan ahora →
              </a>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
            O ingresa a <a href="${renewUrl}" style="color:#2563eb;">${renewUrl.split('/billing')[0]}</a>
            y ve a <strong>Plan y facturación</strong>.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">
            RIPS Guard · Auditoría RIPS Res. 2275/2023 ·
            <a href="${renewUrl.split('/dashboard')[0]}" style="color:#94a3b8;">ripsguard.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
      `.trim(),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
  return res.json()
}

export async function GET(request: Request) {
  // 1. Verificar CRON_SECRET para que solo Vercel pueda llamar este endpoint
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ripsguard.com'
  const renewUrl = `${appUrl}/dashboard/billing`

  const now     = new Date()
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const in1day  = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)

  // 2. Suscripciones activas que vencen en 1 o 3 días (±12 horas)
  const targets = [
    { date: in3days, daysLeft: 3 },
    { date: in1day,  daysLeft: 1 },
  ]

  let emailsSent = 0
  const errors: string[] = []

  for (const { date, daysLeft } of targets) {
    const windowStart = new Date(date.getTime() - 12 * 60 * 60 * 1000).toISOString()
    const windowEnd   = new Date(date.getTime() + 12 * 60 * 60 * 1000).toISOString()

    // Suscripciones activas en esa ventana
    const { data: subs, error: subErr } = await supabase
      .from('subscriptions')
      .select('tenant_id, plan, current_period_end')
      .eq('estado', 'activa')
      .gte('current_period_end', windowStart)
      .lte('current_period_end', windowEnd)

    if (subErr) {
      errors.push(`DB error (${daysLeft}d): ${subErr.message}`)
      continue
    }

    if (!subs || subs.length === 0) continue

    // Para cada suscripción, obtener el email del usuario principal del tenant
    for (const sub of subs) {
      try {
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', sub.tenant_id)
          .limit(1)

        if (!users || users.length === 0) continue

        const userId = users[0].id

        // Obtener email desde auth.users (requiere service role)
        const { data: authUser } = await supabase.auth.admin.getUserById(userId)
        const email = authUser?.user?.email

        if (!email) continue

        await sendRenewalEmail(email, sub.plan, daysLeft, renewUrl)
        emailsSent++

        console.log(`[renewal-reminder] Email enviado a ${email}, plan=${sub.plan}, daysLeft=${daysLeft}`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`Error tenant ${sub.tenant_id}: ${msg}`)
        console.error(`[renewal-reminder] Error:`, msg)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    emailsSent,
    errors: errors.length > 0 ? errors : undefined,
    checkedAt: now.toISOString(),
  })
}
