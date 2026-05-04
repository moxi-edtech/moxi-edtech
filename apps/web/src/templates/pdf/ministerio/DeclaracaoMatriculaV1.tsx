import { Document, Page, StyleSheet, Text, View, Image } from '@react-pdf/renderer'

export type DeclaracaoMatriculaSnapshot = {
  escola_nome: string
  aluno_nome: string
  aluno_bi?: string | null
  curso_nome: string
  classe_nome: string
  turma_nome: string
  ano_letivo: string | number
  data_emissao: string
  hash_validacao?: string | null
  qrCodeDataUrl?: string | null
  diretora_nome?: string | null
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', lineHeight: 1.6 },
  header: { alignItems: 'center', marginBottom: 30 },
  republica: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  ministerio: { fontSize: 10, marginBottom: 10 },
  schoolName: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 10 },
  title: { fontSize: 18, fontWeight: 'bold', textDecoration: 'underline', marginTop: 20, marginBottom: 30, textAlign: 'center' },
  paragraph: { textAlign: 'justify', marginBottom: 20 },
  bold: { fontWeight: 'bold' },
  footer: { marginTop: 50, alignItems: 'center' },
  signatureLine: { borderTopWidth: 1, borderTopColor: '#000', width: 200, marginTop: 40, marginBottom: 5 },
  qrSection: { marginTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  hashText: { fontSize: 8, color: '#666' }
})

export function DeclaracaoMatriculaV1({ snapshot }: { snapshot: DeclaracaoMatriculaSnapshot }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.republica}>REPÚBLICA DE ANGOLA</Text>
          <Text style={s.ministerio}>MINISTÉRIO DA EDUCAÇÃO</Text>
          <Text style={s.schoolName}>{snapshot.escola_nome}</Text>
        </View>

        <Text style={s.title}>DECLARAÇÃO DE MATRÍCULA</Text>

        <Text style={s.paragraph}>
          Para efeitos de direito e a pedido do interessado, declara-se que <Text style={s.bold}>{snapshot.aluno_nome}</Text>, 
          portador do B.I. n.º <Text style={s.bold}>{snapshot.aluno_bi ?? '—'}</Text>, encontra-se regularmente matriculado(a) nesta instituição de ensino no 
          Ano Letivo <Text style={s.bold}>{snapshot.ano_letivo}</Text>, frequentando o curso de <Text style={s.bold}>{snapshot.curso_nome}</Text>, 
          na <Text style={s.bold}>{snapshot.classe_nome}</Text>, Turma <Text style={s.bold}>{snapshot.turma_nome}</Text>.
        </Text>

        <Text style={s.paragraph}>
          Por ser verdade e me ter sido pedido, mandei passar a presente declaração que vai por mim assinada e autenticada com o carimbo a óleo em uso nesta escola.
        </Text>

        <Text style={{ marginTop: 20 }}>Emitido aos, {snapshot.data_emissao}</Text>

        <View style={s.footer}>
          <View style={s.signatureLine} />
          <Text style={s.bold}>A DIRECÇÃO</Text>
          {snapshot.diretora_nome && <Text style={{ fontSize: 9 }}>{snapshot.diretora_nome}</Text>}
        </View>

        <View style={s.qrSection}>
          <View>
            <Text style={s.hashText}>Hash de Autenticidade:</Text>
            <Text style={s.hashText}>{snapshot.hash_validacao ?? '—'}</Text>
          </View>
          {snapshot.qrCodeDataUrl ? (
            <Image src={snapshot.qrCodeDataUrl} style={{ width: 70, height: 70 }} />
          ) : null}
        </View>
      </Page>
    </Document>
  )
}
