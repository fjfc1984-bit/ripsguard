/**
 * Página de Auditoría — Server Component wrapper
 *
 * Verifica suscripción activa antes de renderizar el formulario.
 * Si la suscripción no está activa, redirige a /dashboard/billing.
 */
import { redirect } from 'next/navigation'
import { getSubscriptionStatus } from '@/lib/subscription'
import AuditForm from './AuditForm'

export default async function AuditPage() {
  const sub = await getSubscriptionStatus()

  if (!sub.isActive) {
    redirect('/dashboard/billing?reason=subscription_required')
  }

  return <AuditForm plan={sub.plan} />
}
