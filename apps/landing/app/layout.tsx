import type { Metadata } from 'next'
import { Manrope, Sora } from 'next/font/google'
import type { ReactNode } from 'react'

import { SchemaMarkup } from './components/landing/SchemaMarkup'

import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
})

const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sora',
})

export const metadata: Metadata = {
  title: 'KLASSE — Gestão Escolar do Futuro',
  description: 'Propinas controladas. Documentos prontos. Director com visibilidade real.',
  keywords: [
    'gestão escolar angola',
    'sistema escolar angola',
    'software escolar luanda',
    'controlo propinas escola angola',
    'documentos MED angola',
    'matrícula digital angola',
  ],
  openGraph: {
    title: 'KLASSE — Gestão Escolar do Futuro',
    description: 'Propinas controladas. Documentos prontos. Director com visibilidade real.',
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
    title: 'KLASSE — Gestão Escolar do Futuro',
    description: 'Propinas controladas. Documentos prontos. Director com visibilidade real.',
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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <SchemaMarkup />
      </head>
      <body className={`${manrope.variable} ${sora.variable}`}>{children}</body>
    </html>
  )
}
