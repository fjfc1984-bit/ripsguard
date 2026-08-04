import type { Metadata } from 'next'
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
