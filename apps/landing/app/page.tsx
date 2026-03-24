import type { Metadata } from 'next'

import { LandingPage } from './components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'KLASSE — Sistema de Gestão Escolar em Angola',
  description:
    'Sistema de gestão escolar para Angola com propinas, matrículas, notas, presenças e documentos num único fluxo operacional.',
  alternates: {
    canonical: 'https://klasse.ao/',
  },
}

export default function Page() {
  return <LandingPage />
}
