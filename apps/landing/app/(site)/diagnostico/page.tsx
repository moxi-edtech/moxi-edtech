import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DiagnosisPageClient } from './DiagnosisPageClient'

export const metadata: Metadata = {
  title: 'Diagnóstico de Gestão Escolar | KLASSE',
  description: 'Descubra o nível de maturidade digital da sua escola e como economizar tempo e dinheiro com o KLASSE.',
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">Carregando...</div>}>
      <DiagnosisPageClient />
    </Suspense>
  )
}
