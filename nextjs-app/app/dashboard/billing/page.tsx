/**
 * Billing Page — Server Component que carga el estado real de suscripción
 */
import { getSubscriptionStatus } from '@/lib/subscription'
import BillingClient from './BillingClient'

export default async function BillingPage() {
  const sub = await getSubscriptionStatus()
  return <BillingClient subscription={sub} />
}
