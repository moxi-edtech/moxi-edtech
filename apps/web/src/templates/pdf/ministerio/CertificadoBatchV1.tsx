import { Document, Page, StyleSheet, Text, View, Image } from '@react-pdf/renderer'

export type CertificadoSnapshot = {
  aluno_nome: string
  aluno_bi?: string | null
  turma_nome?: string | null
  ano_letivo?: number | string | null
  media_final?: number | null
  media_extenso?: string | null
  hash_validacao?: string | null
  qrCodeDataUrl?: string | null
}

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 8, fontWeight: 700 },
  subtitle: { marginBottom: 16 },
  row: { marginBottom: 6 },
  label: { fontWeight: 700 },
  footer: { marginTop: 24, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})

export function CertificadoBatchV1({ snapshots }: { snapshots: CertificadoSnapshot[] }) {
  return (
    <Document>
      {snapshots.map((item, idx) => (
        <Page key={`${item.aluno_nome}-${idx}`} size="A4" style={s.page}>
          <Text style={s.title}>Certificado de Habilitações</Text>
          <Text style={s.subtitle}>Documento oficial emitido digitalmente.</Text>

          <View style={s.row}><Text><Text style={s.label}>Aluno:</Text> {item.aluno_nome}</Text></View>
          <View style={s.row}><Text><Text style={s.label}>BI:</Text> {item.aluno_bi ?? '—'}</Text></View>
          <View style={s.row}><Text><Text style={s.label}>Turma:</Text> {item.turma_nome ?? '—'}</Text></View>
          <View style={s.row}><Text><Text style={s.label}>Ano letivo:</Text> {String(item.ano_letivo ?? '—')}</Text></View>
          <View style={s.row}><Text><Text style={s.label}>Média final:</Text> {item.media_final ?? '—'}</Text></View>
          <View style={s.row}><Text><Text style={s.label}>Média por extenso:</Text> {item.media_extenso ?? '—'}</Text></View>

          <View style={s.footer}>
            <Text>Hash validação: {item.hash_validacao ?? '—'}</Text>
            {item.qrCodeDataUrl ? <Image src={item.qrCodeDataUrl} style={{ width: 82, height: 82 }} /> : <Text>QR indisponível</Text>}
          </View>
        </Page>
      ))}
    </Document>
  )
}
