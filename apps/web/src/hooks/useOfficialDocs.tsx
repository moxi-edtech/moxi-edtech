'use client'

import { pdf } from '@react-pdf/renderer'
import { MiniPautaV2 } from '@/templates/pdf/ministerio/MiniPautaV2'
import { PautaTrimestralV1 } from '@/templates/pdf/ministerio/PautaTrimestralV1'

type NotaTrimestre = {
  mac: number | null
  npp: number | null
  npt: number | null
  mt: number | null
}

export type MiniPautaPayload = {
  metadata: {
    provincia: string
    escola: string
    anoLectivo: string
    turma: string
    disciplina: string
    professor: string
    diretor: string
    emissao: string
    hash: string
    brasaoUrl?: string
    qrCodeDataUrl?: string
    trimestresAtivos?: Array<1 | 2 | 3>
    mostrarTrimestresInativos?: boolean
  }
  alunos: Array<{
    id: string
    numero: number
    nome: string
    genero: 'M' | 'F'
    trim1: NotaTrimestre
    trim2: NotaTrimestre
    trim3: NotaTrimestre
    mfd: number | null
    obs: string
  }>
}

export type TrimestreNumero = 1 | 2 | 3

const downloadBlob = (blob: Blob, filename: string) => {
  if (typeof window === 'undefined') return
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

export const useOfficialDocs = () => {
  const gerarMiniPauta = async (payload: MiniPautaPayload, filename?: string) => {
    const blob = await pdf(<MiniPautaV2 {...payload} />).toBlob()
    downloadBlob(blob, filename ?? `MiniPauta_${payload.metadata.disciplina}_${Date.now()}.pdf`)
    return blob
  }

  const gerarPautaTrimestral = async (
    payload: MiniPautaPayload,
    trimestre: TrimestreNumero,
    filename?: string
  ) => {
    const blob = await pdf(
      <PautaTrimestralV1 metadata={payload.metadata} alunos={payload.alunos} trimestre={trimestre} />
    ).toBlob()
    downloadBlob(blob, filename ?? `PautaTrimestral_${payload.metadata.disciplina}_${Date.now()}.pdf`)
    return blob
  }

  return { gerarMiniPauta, gerarPautaTrimestral }
}
