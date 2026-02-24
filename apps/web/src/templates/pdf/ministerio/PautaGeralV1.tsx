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
    width: "100%",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    minHeight: 24,
    alignItems: "center",
  },
  headerRow: {
    backgroundColor: "#f8fafc",
    fontWeight: "bold",
  },
  colNum: {
    width: 25,
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
    padding: 2,
    textAlign: "center",
  },
  colNome: {
    width: 180,
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
    padding: 4,
  },
  colIdade: {
    width: 35,
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
    padding: 2,
    textAlign: "center",
  },
  colSexo: {
    width: 30,
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
    padding: 2,
    textAlign: "center",
  },
  colObs: {
    width: 60,
    padding: 2,
    textAlign: "center",
  },
  subjectsContainer: {
    flex: 1,
    flexDirection: "row",
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
  },
  subjectBlock: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
  },
  subjectHeaderTop: {
    height: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
  },
  subjectHeaderBottom: {
    flexDirection: "row",
    height: 16,
  },
  gradeCell: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
  },
  gradeCellLast: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 7,
  },
  textBold: {
    fontSize: 7,
    fontWeight: "bold",
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

export function PautaGeralV1({ metadata, disciplinas, alunos }: Props) {
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
            <View style={[s.row, s.headerRow, { minHeight: 32 }]} wrap={false}>
              <View style={s.colNum}>
                <Text style={s.textBold}>Nº</Text>
              </View>
              <View style={s.colNome}>
                <Text style={s.textBold}>Nome Completo do Aluno</Text>
              </View>
              <View style={s.colIdade}>
                <Text style={s.textBold}>Idade</Text>
              </View>
              <View style={s.colSexo}>
                <Text style={s.textBold}>Sexo</Text>
              </View>
              <View style={s.subjectsContainer}>
                {disciplinas.map((disciplina, index) => (
                  <View
                    key={disciplina.id}
                    style={[
                      s.subjectBlock,
                      index === disciplinas.length - 1 ? { borderRightWidth: 0 } : {},
                    ]}
                  >
                    <View style={s.subjectHeaderTop}>
                      <Text style={s.textBold}>{disciplina.nome.substring(0, 10)}</Text>
                    </View>
                    <View style={s.subjectHeaderBottom}>
                      <View style={s.gradeCell}>
                        <Text style={s.textBold}>MAC</Text>
                      </View>
                      <View style={s.gradeCell}>
                        <Text style={s.textBold}>NPP</Text>
                      </View>
                      <View style={s.gradeCell}>
                        <Text style={s.textBold}>PT</Text>
                      </View>
                      <View style={s.gradeCellLast}>
                        <Text style={s.textBold}>MT</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
              <View style={s.colObs}>
                <Text style={s.textBold}>Obs.</Text>
              </View>
            </View>

            {pageRows.map((aluno) => (
              <View key={aluno.aluno_id} style={s.row} wrap={false}>
                <View style={s.colNum}>
                  <Text style={s.text}>{String(aluno.numero).padStart(2, "0")}</Text>
                </View>
                <View style={s.colNome}>
                  <Text style={s.text}>{aluno.nome.substring(0, 40)}</Text>
                </View>
                <View style={s.colIdade}>
                  <Text style={s.text}>{aluno.idade}</Text>
                </View>
                <View style={s.colSexo}>
                  <Text style={s.text}>{aluno.sexo}</Text>
                </View>
                <View style={s.subjectsContainer}>
                  {disciplinas.map((disciplina, index) => {
                    const notas = aluno.disciplinas[disciplina.id] ?? {
                      mac: "-",
                      npp: "-",
                      pt: "-",
                      mt: "-",
                    }

                    return (
                      <View
                        key={`${aluno.aluno_id}-${disciplina.id}`}
                        style={[
                          s.subjectBlock,
                          { flexDirection: "row" },
                          index === disciplinas.length - 1 ? { borderRightWidth: 0 } : {},
                        ]}
                      >
                        <View style={s.gradeCell}>
                          <Text style={s.text}>{notas.mac}</Text>
                        </View>
                        <View style={s.gradeCell}>
                          <Text style={s.text}>{notas.npp}</Text>
                        </View>
                        <View style={s.gradeCell}>
                          <Text style={s.text}>{notas.pt}</Text>
                        </View>
                        <View style={s.gradeCellLast}>
                          <Text style={s.textBold}>{notas.mt}</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
                <View style={s.colObs}>
                  <Text style={s.text}>{aluno.obs || "-"}</Text>
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
