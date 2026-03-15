import type { ReactNode } from 'react'

import './globals.css'

export const metadata = {
  title: 'KLASSE — Gestão Escolar para Angola',
  description: 'Plataforma de gestão escolar feita para a realidade angolana.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  )
}
