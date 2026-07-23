import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
