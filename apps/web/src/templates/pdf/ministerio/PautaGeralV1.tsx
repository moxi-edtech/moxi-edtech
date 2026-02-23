import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import type { PautaGeralPayload } from "@/lib/pedagogico/pauta-geral-types"

type Props = PautaGeralPayload

const ROWS_PER_PAGE = 18

const s = StyleSheet.create({
  page: {
    padding: 18,
    fontSize: 7,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  headerSub: {
    fontSize: 8,
    textAlign: "center",
  },
  meta: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 7,
    textAlign: "center",
  },
  table: {
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  cell: {
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  cellHeader: {
    fontWeight: "bold",
    textAlign: "center",
  },
  cellCenter: {
    textAlign: "center",
  },
  cellRight: {
    textAlign: "right",
  },
  disciplinaHeader: {
    backgroundColor: "#f8fafc",
  },
  footer: {
    marginTop: 10,
    fontSize: 7,
  },
  assinaturaRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  assinaturaBox: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    paddingTop: 4,
    textAlign: "center",
    fontSize: 7,
  },
})

const chunkRows = <T,>(rows: T[], size: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size))
  }
  return chunks
}

const toPercent = (value: number) => `${value.toFixed(2)}%`

export function PautaGeralV1({ metadata, disciplinas, alunos }: Props) {
  const fixedWidth = 6 + 28 + 5 + 4 + 8
  const disciplinaWidth = disciplinas.length > 0 ? (100 - fixedWidth) / disciplinas.length : 0
  const disciplinaCellWidth = disciplinaWidth / 4

  const pages = chunkRows(alunos, ROWS_PER_PAGE)

  return (
    <Document>
      {pages.map((pageRows, pageIndex) => (
        <Page key={`page-${pageIndex}`} size="A3" orientation="landscape" style={s.page}>
          <View style={s.header}>
            <Text style={s.headerTitle}>República de Angola</Text>
            <Text style={s.headerSub}>Governo Provincial de {metadata.provincia}</Text>
            <Text style={s.headerSub}>Gabinete Provincial da Educação</Text>
            <Text style={s.headerSub}>{metadata.escola}</Text>
          </View>

          <Text style={s.meta}>
            Pauta de Classificação do {metadata.trimestre}º Trimestre • Classe: {metadata.classe} • Turma: {metadata.turma} •
            Curso: {metadata.curso} • Ano Lectivo: {metadata.anoLectivo} • Turno: {metadata.turno}
          </Text>

          <View style={s.table}>
            <View style={[s.row, s.disciplinaHeader]} wrap={false}>
              <View style={[s.cell, { width: toPercent(6) }]}>
                <Text style={[s.cellHeader, s.cellCenter]}>Nº</Text>
              </View>
              <View style={[s.cell, { width: toPercent(28) }]}>
                <Text style={[s.cellHeader, s.cellCenter]}>Nome Completo do Aluno</Text>
              </View>
              <View style={[s.cell, { width: toPercent(5) }]}>
                <Text style={[s.cellHeader, s.cellCenter]}>Idade</Text>
              </View>
              <View style={[s.cell, { width: toPercent(4) }]}>
                <Text style={[s.cellHeader, s.cellCenter]}>Sexo</Text>
              </View>
              {disciplinas.map((disciplina) => (
                <View key={disciplina.id} style={[s.cell, { width: toPercent(disciplinaWidth) }]}>
                  <Text style={[s.cellHeader, s.cellCenter]}>{disciplina.nome}</Text>
                </View>
              ))}
              <View style={[s.cell, { width: toPercent(8) }]}>
                <Text style={[s.cellHeader, s.cellCenter]}>Obs.</Text>
              </View>
            </View>

            <View style={[s.row, s.disciplinaHeader]} wrap={false}>
              <View style={[s.cell, { width: toPercent(6) }]} />
              <View style={[s.cell, { width: toPercent(28) }]} />
              <View style={[s.cell, { width: toPercent(5) }]} />
              <View style={[s.cell, { width: toPercent(4) }]} />
              {disciplinas.map((disciplina) => (
                <View key={`sub-${disciplina.id}`} style={{ flexDirection: "row", width: toPercent(disciplinaWidth) }}>
                  {["MAC", "NPP", "PT", "MT"].map((label, idx) => (
                    <View key={`${disciplina.id}-${label}`} style={[s.cell, { width: toPercent(disciplinaCellWidth) }]}> 
                      <Text style={[s.cellHeader, s.cellCenter]}>{label}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <View style={[s.cell, { width: toPercent(8) }]} />
            </View>

            {pageRows.map((aluno) => (
              <View key={aluno.aluno_id} style={s.row} wrap={false}>
                <View style={[s.cell, { width: toPercent(6) }]}>
                  <Text style={[s.cellCenter]}>{String(aluno.numero).padStart(2, "0")}</Text>
                </View>
                <View style={[s.cell, { width: toPercent(28) }]}>
                  <Text>{aluno.nome}</Text>
                </View>
                <View style={[s.cell, { width: toPercent(5) }]}>
                  <Text style={[s.cellCenter]}>{aluno.idade}</Text>
                </View>
                <View style={[s.cell, { width: toPercent(4) }]}>
                  <Text style={[s.cellCenter]}>{aluno.sexo}</Text>
                </View>
                {disciplinas.map((disciplina) => {
                  const notas = aluno.disciplinas[disciplina.id]
                  const values = [notas?.mac ?? "-", notas?.npp ?? "-", notas?.pt ?? "-", notas?.mt ?? "-"]
                  return (
                    <View key={`${aluno.aluno_id}-${disciplina.id}`} style={{ flexDirection: "row", width: toPercent(disciplinaWidth) }}>
                      {values.map((valor, idx) => (
                        <View key={`${aluno.aluno_id}-${disciplina.id}-${idx}`} style={[s.cell, { width: toPercent(disciplinaCellWidth) }]}> 
                          <Text style={[s.cellCenter]}>{valor}</Text>
                        </View>
                      ))}
                    </View>
                  )
                })}
                <View style={[s.cell, { width: toPercent(8) }]}>
                  <Text>{aluno.obs}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.footer}>
            <Text>Local e Data: {metadata.local}, aos ____ de ____________ de 20__</Text>
            <View style={s.assinaturaRow}>
              <Text style={s.assinaturaBox}>O(A) Director(a) de Turma</Text>
              <Text style={s.assinaturaBox}>O(A) Sub-director(a) Pedagógico(a)</Text>
              <Text style={s.assinaturaBox}>O(A) Director(a) Geral</Text>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  )
}
