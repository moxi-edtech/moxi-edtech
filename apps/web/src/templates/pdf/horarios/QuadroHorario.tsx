import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

type QuadroHorarioPdfProps = {
  escola: string;
  curso: string;
  classe: string;
  turma: string;
  turno: string;
  sala?: string | null;
  anoLetivo?: number | null;
  dias: string[];
  tempos: string[];
  grid: string[][];
  generatedAt: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
  },
  subtitle: {
    marginTop: 4,
    color: "#475569",
  },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaItem: {
    color: "#334155",
  },
  table: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 4,
    paddingHorizontal: 4,
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 20,
  },
  cellHeader: {
    backgroundColor: "#f8fafc",
    fontWeight: 600,
  },
  cellTime: {
    minWidth: 80,
    flexGrow: 0,
    flexBasis: 80,
  },
  footer: {
    marginTop: 12,
    fontSize: 8,
    color: "#64748b",
  },
});

export function QuadroHorarioPdf({
  escola,
  curso,
  classe,
  turma,
  turno,
  sala,
  anoLetivo,
  dias,
  tempos,
  grid,
  generatedAt,
}: QuadroHorarioPdfProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Quadro de Horários</Text>
          <Text style={styles.subtitle}>Horário oficial da turma</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>Escola: {escola}</Text>
            <Text style={styles.metaItem}>Curso: {curso}</Text>
            <Text style={styles.metaItem}>Classe: {classe}</Text>
            <Text style={styles.metaItem}>Turma: {turma}</Text>
            <Text style={styles.metaItem}>Turno: {turno}</Text>
            {sala ? <Text style={styles.metaItem}>Sala: {sala}</Text> : null}
            {anoLetivo ? <Text style={styles.metaItem}>Ano: {anoLetivo}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.cellHeader, styles.cellTime]}>Horário</Text>
            {dias.map((dia) => (
              <Text key={dia} style={[styles.cell, styles.cellHeader]}>
                {dia}
              </Text>
            ))}
          </View>
          {tempos.map((tempo, index) => (
            <View key={tempo} style={styles.row}>
              <Text style={[styles.cell, styles.cellTime]}>{tempo}</Text>
              {grid[index]?.map((valor, colIndex) => (
                <Text key={`${tempo}-${colIndex}`} style={styles.cell}>
                  {valor || ""}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.footer}>Gerado em {generatedAt}</Text>
      </Page>
    </Document>
  );
}
