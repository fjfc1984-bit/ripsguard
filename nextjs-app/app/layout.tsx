import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ripsguard.com'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'RIPS Guard — Auditoria RIPS Nueva Generacion',
    template: '%s | RIPS Guard',
  },
  description: 'Valida archivos RIPS JSON al instante contra la Resolucion 2275 de 2023. Detecta errores, evita glosas y ahorra tiempo de facturacion.',
  keywords: ['RIPS', 'Resolucion 2275', 'auditoria RIPS', 'RIPS 2.0', 'habilitacion', 'facturacion medica Colombia'],
  openGraph: {
    title: 'RIPS Guard — Auditoria RIPS Nueva Generacion',
    description: 'Valida archivos RIPS JSON al instante. Detecta errores antes de enviar a la aseguradora.',
    url: APP_URL,
    siteName: 'RIPS Guard',
    locale: 'es_CO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RIPS Guard — Auditoria RIPS Nueva Generacion',
    description: 'Valida archivos RIPS JSON al instante. Detecta errores antes de enviar a la aseguradora.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.className}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
    }
