import type { Metadata } from 'next'

import EbookCapture from '../EbookCapture'

export const metadata: Metadata = {
  title: 'O futuro da educação em Angola | KLASSE',
  description: 'Guia gratuito sobre gestão escolar, tecnologia e inteligência artificial para 2026/2027.',
  alternates: { canonical: 'https://klasse.ao/ebook/futuro' },
}

export default function FuturoEbookPage() {
  return <EbookCapture variant="futuro" />
}
