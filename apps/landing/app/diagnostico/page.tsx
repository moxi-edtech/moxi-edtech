import type { Metadata } from 'next'
import { DiagnosisPageClient } from './DiagnosisPageClient'

export const metadata: Metadata = {
  title: 'Diagnóstico de Gestão Escolar | KLASSE',
  description: 'Descubra o nível de maturidade digital da sua escola e como economizar tempo e dinheiro com o KLASSE.',
}

export default function Page() {
  return <DiagnosisPageClient />
}
