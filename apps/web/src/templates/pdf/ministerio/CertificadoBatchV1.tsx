import { Document, Page, StyleSheet, Text, View, Image } from '@react-pdf/renderer'

export type CertificadoSnapshot = {
  aluno_nome: string
  aluno_bi?: string | null
  turma_nome?: string | null
  turma_turno?: string | null
  ano_letivo?: number | string | null
  media_final?: number | null
  media_extenso?: string | null
  hash_validacao?: string | null
  qrCodeDataUrl?: string | null
  escola_nome?: string | null
  diretora_nome?: string | null
  pai_nome?: string | null
  mae_nome?: string | null
  naturalidade?: string | null
  provincia?: string | null
  data_nascimento?: string | null
  bi_emitido_em?: string | null
  regime?: string | null
  classe_concluida?: string | null
  curso_nome?: string | null
  area_formacao?: string | null
  processo_individual_numero?: string | null
}

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 8, fontWeight: 700 },
  subtitle: { marginBottom: 16 },
  paragraph: { marginBottom: 12, lineHeight: 1.45, textAlign: 'justify' },
  row: { marginBottom: 6 },
  label: { fontWeight: 700 },
  footer: { marginTop: 24, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})

const clean = (value?: string | null) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function buildCertificadoTexto(item: CertificadoSnapshot) {
  const escola = clean(item.escola_nome) ?? 'escola'
  const diretora = clean(item.diretora_nome) ?? 'a direção da escola'
  const alunoNome = clean(item.aluno_nome) ?? 'o(a) aluno(a)'
  const classe = clean(item.classe_concluida) ?? '—'
  const curso = clean(item.curso_nome) ?? '—'
  const areaFormacao = clean(item.area_formacao) ?? '—'
  const regime =
    clean(item.regime) ??
    (clean(item.turma_turno)?.toLowerCase().includes('noite') ? 'noturno' : clean(item.turma_turno) ? 'diurno' : '—')
  const anoLetivo = item.ano_letivo != null ? String(item.ano_letivo) : '—'

  const filiacaoPai = clean(item.pai_nome)
  const filiacaoMae = clean(item.mae_nome)
  const filiacao =
    filiacaoPai || filiacaoMae
      ? `, filho(a) de ${filiacaoPai ?? '—'} e de ${filiacaoMae ?? '—'}`
      : ''

  const naturalidade = clean(item.naturalidade)
  const provincia = clean(item.provincia)
  const origem = naturalidade ? `, natural de ${naturalidade}${provincia ? `, Província de ${provincia}` : ''}` : ''

  const nascimento = clean(item.data_nascimento) ? `, nascido(a) em ${clean(item.data_nascimento)}` : ''
  const bi = clean(item.aluno_bi) ? `, portador(a) do B.I. n.º ${clean(item.aluno_bi)}` : ''
  const biEmissao = clean(item.bi_emitido_em) ? `, emitido em ${clean(item.bi_emitido_em)}` : ''
  const processo = clean(item.processo_individual_numero)
    ? `, conforme consta do processo individual n.º ${clean(item.processo_individual_numero)}`
    : ''

  return `A Directora do ${escola}, ${diretora}, certifica, nos termos dos artigos 25.º e 27.º dos Estatutos do Subsistema do Ensino Técnico-Profissional, aprovados pelo Decreto n.º 5355/2025, de 16 de julho, que ${alunoNome}${filiacao}${origem}${nascimento}${bi}${biEmissao}, concluiu, em regime ${regime}, no ano letivo ${anoLetivo}, a ${classe}, do Curso de ${curso}, na Área de Formação de ${areaFormacao}${processo}.`
}

export function CertificadoBatchV1({ snapshots }: { snapshots: CertificadoSnapshot[] }) {
  return (
    <Document>
      {snapshots.map((item, idx) => (
        <Page key={`${item.aluno_nome}-${idx}`} size="A4" style={s.page}>
          <Text style={s.title}>Certificado de Habilitações</Text>
          <Text style={s.subtitle}>Documento oficial emitido digitalmente.</Text>
          <Text style={s.paragraph}>{buildCertificadoTexto(item)}</Text>

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
