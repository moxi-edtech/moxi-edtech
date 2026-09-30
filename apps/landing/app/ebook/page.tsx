import type { Metadata } from 'next'

import EbookCapture from './EbookCapture'

export const metadata: Metadata = {
  title: 'E-book gratuito | KLASSE',
  description:
    'Prepare a sua escola para as matrículas com um guia prático do KLASSE para 2026/2027.',
  alternates: { canonical: 'https://klasse.ao/ebook' },
}

export default function EbookPage() {
  return <EbookCapture />
}
