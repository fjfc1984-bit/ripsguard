/**
 * DEPRECATED — Stripe fue reemplazado por Bold.co (pasarela colombiana).
 * Este endpoint ya no se usa. Retorna 410 Gone para evitar confusión.
 * Ver: /api/bold/create-order
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Este endpoint fue reemplazado. Usa /api/bold/create-order' },
    { status: 410 }
  )
}
