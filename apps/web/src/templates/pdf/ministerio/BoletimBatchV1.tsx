import { Document, Page, StyleSheet, Text, View, Image } from '@react-pdf/renderer'

export type BoletimDisciplina = {
  nome: string
  conta_para_media_med: boolean
  t1?: number | null
  t2?: number | null
  t3?: number | null
}

export type BoletimSnapshot = {
  aluno_nome: string
  turma_nome?: string | null
  ano_letivo?: number | string | null
  media_final?: number | null
  media_extenso?: string | null
  hash_validacao?: string | null
  qrCodeDataUrl?: string | null
  disciplinas: BoletimDisciplina[]
}

const s = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 8, fontWeight: 700 },
  row: { marginBottom: 4 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d1d5db', marginTop: 8, paddingBottom: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 4 },
})

export function BoletimBatchV1({ snapshots }: { snapshots: BoletimSnapshot[] }) {
  return (
    <Document>
      {snapshots.map((item, idx) => (
        <Page key={`${item.aluno_nome}-${idx}`} size="A4" style={s.page}>
          <Text style={s.title}>Boletim Escolar</Text>
          <View style={s.row}><Text>Aluno: {item.aluno_nome}</Text></View>
          <View style={s.row}><Text>Turma: {item.turma_nome ?? '—'} • Ano letivo: {String(item.ano_letivo ?? '—')}</Text></View>
          <View style={s.row}><Text>Média final: {item.media_final ?? '—'} ({item.media_extenso ?? '—'})</Text></View>

          <View style={s.tableHeader}>
            <Text style={{ width: '52%' }}>Disciplina</Text>
            <Text style={{ width: '12%' }}>T1</Text>
            <Text style={{ width: '12%' }}>T2</Text>
            <Text style={{ width: '12%' }}>T3</Text>
            <Text style={{ width: '12%' }}>Tipo</Text>
          </View>

          {item.disciplinas.map((d, i) => (
            <View key={`${d.nome}-${i}`} style={s.tableRow}>
              <Text style={{ width: '52%' }}>{d.nome}</Text>
              <Text style={{ width: '12%' }}>{d.t1 ?? '—'}</Text>
              <Text style={{ width: '12%' }}>{d.t2 ?? '—'}</Text>
              <Text style={{ width: '12%' }}>{d.t3 ?? '—'}</Text>
              <Text style={{ width: '12%' }}>{d.conta_para_media_med ? 'Oficial' : 'Não oficial'}</Text>
            </View>
          ))}

          <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>Hash validação: {item.hash_validacao ?? '—'}</Text>
            {item.qrCodeDataUrl ? <Image src={item.qrCodeDataUrl} style={{ width: 76, height: 76 }} /> : <Text>QR indisponível</Text>}
          </View>
        </Page>
      ))}
    </Document>
  )
}
