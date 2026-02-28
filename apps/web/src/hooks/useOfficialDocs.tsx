'use client'

import { pdf } from '@react-pdf/renderer'
import { MiniPautaV2 } from '@/templates/pdf/ministerio/MiniPautaV2'
import { PautaTrimestralV1 } from '@/templates/pdf/ministerio/PautaTrimestralV1'
import { CertificadoBatchV1, type CertificadoSnapshot } from '@/templates/pdf/ministerio/CertificadoBatchV1'
import { BoletimBatchV1, type BoletimSnapshot } from '@/templates/pdf/ministerio/BoletimBatchV1'
import { notaParaExtensoPTAO } from '@/lib/academico/extenso'

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

const buildQrDataUrl = (value: string) =>
  `https://quickchart.io/qr?text=${encodeURIComponent(value)}&margin=1&size=240`

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

  const gerarCertificadoBatch = async (turmaId: string, alunosIds: string[] = []) => {
    const res = await fetch('/api/secretaria/documentos/certificado/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turma_id: turmaId, alunos_ids: alunosIds }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar certificados')

    const snapshots = ((json?.snapshots || []) as CertificadoSnapshot[]).map((item) => {
      const mediaFinal = typeof item.media_final === 'number' ? item.media_final : null
      return {
        ...item,
        media_extenso:
          item.media_extenso ?? (typeof mediaFinal === 'number' ? notaParaExtensoPTAO(mediaFinal) : null),
        qrCodeDataUrl: item.hash_validacao ? buildQrDataUrl(item.hash_validacao) : null,
      }
    })

    const blob = await pdf(<CertificadoBatchV1 snapshots={snapshots} />).toBlob()
    downloadBlob(blob, `Certificados_${turmaId}_${Date.now()}.pdf`)
    return blob
  }

  const gerarBoletimBatch = async (turmaId: string, alunosIds: string[] = []) => {
    const res = await fetch('/api/secretaria/documentos/boletim/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turma_id: turmaId, alunos_ids: alunosIds }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar boletins')

    const snapshots = ((json?.snapshots || []) as BoletimSnapshot[]).map((item) => {
      const mediaFinal = typeof item.media_final === 'number' ? item.media_final : null
      return {
        ...item,
        media_extenso:
          item.media_extenso ?? (typeof mediaFinal === 'number' ? notaParaExtensoPTAO(mediaFinal) : null),
        qrCodeDataUrl: item.hash_validacao ? buildQrDataUrl(item.hash_validacao) : null,
      }
    })

    const blob = await pdf(<BoletimBatchV1 snapshots={snapshots} />).toBlob()
    downloadBlob(blob, `Boletins_${turmaId}_${Date.now()}.pdf`)
    return blob
  }

  return { gerarMiniPauta, gerarPautaTrimestral, gerarCertificadoBatch, gerarBoletimBatch }
}
