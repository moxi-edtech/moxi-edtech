import type { Metadata } from 'next'
import { Manrope, Sora } from 'next/font/google'
import type { ReactNode } from 'react'

import { SchemaMarkup } from './components/landing/SchemaMarkup'

import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-manrope',
})

const sora = Sora({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
  variable: '--font-sora',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://klasse.ao'),
  title: {
    default: 'KLASSE — Gestão Escolar do Futuro',
    template: '%s | KLASSE',
  },
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
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
  alternates: {
    canonical: 'https://klasse.ao',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-AO" className={`${manrope.variable} ${sora.variable}`}>
      <head>
        <link rel="icon" href="/logo-klasse.png" type="image/png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <SchemaMarkup />
      </head>
      <body>{children}</body>
    </html>
  )
}
