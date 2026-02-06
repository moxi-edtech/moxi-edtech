import React from 'react'
import { Page, Text, View, Document, Image } from '@react-pdf/renderer'
import { medStyles as s } from './styles'

type NotaTrimestre = {
  mac: number | null
  npp: number | null
  npt: number | null
  mt: number | null
}

type AlunoPauta = {
  id: string
  numero: number
  nome: string
  genero: 'M' | 'F'
  trim1: NotaTrimestre
  trim2: NotaTrimestre
  trim3: NotaTrimestre
  mfd: number | null
  obs: string
}

type PautaTrimestralProps = {
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
  }
  alunos: AlunoPauta[]
  trimestre: 1 | 2 | 3
}

const formatNota = (valor: number | null) => {
  if (valor === null || Number.isNaN(valor)) return '-'
  return valor % 1 === 0 ? String(valor) : valor.toFixed(1)
}

type PdfStyle = (typeof s)[keyof typeof s]

const getNotaStyle = (valor: number | null, isBold = false): PdfStyle[] => {
  const styles: PdfStyle[] = []
  if (isBold) styles.push(s.bold)
  if (typeof valor === 'number' && valor < 10) styles.push(s.redText)
  return styles
}

const getNotas = (aluno: AlunoPauta, trimestre: 1 | 2 | 3) => {
  if (trimestre === 1) return aluno.trim1
  if (trimestre === 2) return aluno.trim2
  return aluno.trim3
}

export const PautaTrimestralV1: React.FC<PautaTrimestralProps> = ({ metadata, alunos, trimestre }) => (
  <Document title={`Pauta Trimestral - ${metadata.turma} - ${metadata.disciplina}`}>
    <Page size="A4" orientation="landscape" style={s.page}>
      <Text style={s.watermark}>DOCUMENTO OFICIAL</Text>

      <View style={s.headerWrapper}>
        {metadata.brasaoUrl ? (
          <Image src={metadata.brasaoUrl} style={{ width: 40, height: 40, marginBottom: 5 }} />
        ) : null}
        <Text style={s.republicaText}>República de Angola</Text>
        <Text style={s.subHeaderText}>Governo da Província de {metadata.provincia}</Text>
        <Text style={s.subHeaderText}>Gabinete Provincial da Educação</Text>
        <Text style={s.schoolName}>{metadata.escola}</Text>
        <Text style={s.docTitle}>Pauta Trimestral — {trimestre}º Trimestre</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, fontSize: 10 }}>
        <View style={{ width: '40%' }}>
          <Text>
            Disciplina: <Text style={s.bold}>{metadata.disciplina}</Text>
          </Text>
          <Text>
            Professor: <Text style={s.bold}>{metadata.professor}</Text>
          </Text>
        </View>
        <View style={{ width: '30%' }}>
          <Text>
            Turma: <Text style={s.bold}>{metadata.turma}</Text>
          </Text>
          <Text>
            Período: <Text style={s.bold}>Regular / Diurno</Text>
          </Text>
        </View>
        <View style={{ width: '30%', alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 8, color: 'gray' }}>ID: {metadata.hash.substring(0, 8)}</Text>
        </View>
      </View>

      <View style={s.table}>
        <View style={[s.row, s.headerRow, { height: 25 }]}>
          <Text style={[s.cell, { width: '6%' }]}>Nº</Text>
          <Text style={[s.cell, s.cellLeft, { width: '34%' }]}>Nome Completo</Text>
          <Text style={[s.cell, { width: '12%' }]}>MAC</Text>
          <Text style={[s.cell, { width: '12%' }]}>NPP</Text>
          <Text style={[s.cell, { width: '12%' }]}>NPT</Text>
          <Text style={[s.cell, { width: '12%' }]}>MT</Text>
          <Text style={[s.cell, { width: '12%' }]}>OBS</Text>
        </View>

        {alunos.map((aluno, idx) => {
          const notas = getNotas(aluno, trimestre)
          return (
            <View key={aluno.id} style={[s.row, { backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }]}>
              <Text style={[s.cell, { width: '6%' }]}>{aluno.numero}</Text>
              <Text style={[s.cell, s.cellLeft, { width: '34%' }]}>{aluno.nome}</Text>
              <Text style={[s.cell, { width: '12%' }, ...getNotaStyle(notas.mac)]}>
                {formatNota(notas.mac)}
              </Text>
              <Text style={[s.cell, { width: '12%' }, ...getNotaStyle(notas.npp)]}>
                {formatNota(notas.npp)}
              </Text>
              <Text style={[s.cell, { width: '12%' }, ...getNotaStyle(notas.npt)]}>
                {formatNota(notas.npt)}
              </Text>
              <Text style={[s.cell, { width: '12%', backgroundColor: '#f0fdf4' }, ...getNotaStyle(notas.mt, true)]}>
                {formatNota(notas.mt)}
              </Text>
              <Text style={[s.cell, { width: '12%' }]}>{aluno.obs || '-'}</Text>
            </View>
          )
        })}
      </View>

      <View style={{ marginTop: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ flexDirection: 'row', gap: 40 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ borderBottomWidth: 1, width: 120, marginBottom: 4 }} />
            <Text>O Professor</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <View style={{ borderBottomWidth: 1, width: 120, marginBottom: 4 }} />
            <Text>O Director Pedagógico</Text>
            <Text style={[s.bold, { fontSize: 8 }]}>{metadata.diretor}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'center' }}>
          {metadata.qrCodeDataUrl ? (
            <Image src={metadata.qrCodeDataUrl} style={{ width: 40, height: 40, marginBottom: 2 }} />
          ) : (
            <View style={{ width: 40, height: 40, backgroundColor: '#000', marginBottom: 2 }} />
          )}
          <Text style={{ fontSize: 6 }}>Validar autenticidade</Text>
        </View>
      </View>

      <Text style={{ position: 'absolute', bottom: 10, left: 30, fontSize: 7, color: '#9ca3af' }}>
        Processado pelo Sistema KLASSE em {metadata.emissao} • {metadata.hash} • Página 1 de 1
      </Text>
    </Page>
  </Document>
)
