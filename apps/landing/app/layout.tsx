import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { SchemaMarkup } from './components/landing/SchemaMarkup'

import './globals.css'

export const metadata: Metadata = {
  title: 'KLASSE — Sistema de Gestão Escolar para Angola',
  description:
    'Controlo de propinas, matrículas, documentos MED e portais para director, secretaria, professores e alunos. Feito para escolas angolanas.',
  keywords: [
    'gestão escolar angola',
    'sistema escolar angola',
    'software escolar luanda',
    'controlo propinas escola angola',
    'documentos MED angola',
    'matrícula digital angola',
  ],
  openGraph: {
    title: 'KLASSE — Gestão Escolar para Angola',
    description: 'A escola bem gerida começa aqui.',
    url: 'https://klasse.ao',
    siteName: 'KLASSE',
    locale: 'pt_AO',
    type: 'website',
    images: [
      {
        url: 'https://klasse.ao/og-image.png',
        width: 1200,
        height: 630,
        alt: 'KLASSE — Gestão Escolar para Angola',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KLASSE — Gestão Escolar para Angola',
    description: 'A escola bem gerida começa aqui.',
    images: ['https://klasse.ao/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://klasse.ao',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-AO">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="icon" href="/logo-klasse.png" type="image/png" />
        <SchemaMarkup />
      </head>
      <body>{children}</body>
    </html>
  )
}
