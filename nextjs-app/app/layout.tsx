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
    default: 'RIPS Guard — Auditoría RIPS Nueva Generación',
    template: '%s | RIPS Guard',
  },
  description: 'Valida archivos RIPS JSON al instante contra la Resolución 2275 de 2023. Detecta errores, evita glosas y ahorra tiempo de facturación.',
  keywords: ['RIPS', 'Resolución 2275', 'auditoría RIPS', 'RIPS 2.0', 'habilitación', 'facturación médica Colombia'],
  openGraph: {
    title: 'RIPS Guard — Auditoría RIPS Nueva Generación',
    description: 'Valida archivos RIPS JSON al instante. Detecta errores antes de enviar a la aseguradora.',
    url: APP_URL,
    siteName: 'RIPS Guard',
    locale: 'es_CO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RIPS Guard — Auditoría RIPS Nueva Generación',
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
}import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RIPS Guard - Auditoría RIPS Nueva Generación',
  description: 'Valida y audita archivos RIPS JSON según Resolución 2275 de 2023',
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
}import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700', '800'],
    display: 'swap',
})

export const metadata: Metadata = {
    title: 'RIPS Guard - Auditoría RIPS Nueva Generación',
    description: 'Valida y audita archivos RIPS JSON según Resolución 2275 de 2023',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
          <html lang="es" className={inter.className}>
                  <body>{children}</body>
          </html>
        )
}
