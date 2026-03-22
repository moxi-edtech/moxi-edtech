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

// ─── TOKENS KLASSE MAPEADOS PARA PDF ──────────────────────────────────────────
const COLORS = {
  primary: "#1F6B3B", // Verde Brand
  gold: "#E3B23C",    // Dourado Accent
  slate950: "#020617",
  slate700: "#334155",
  slate500: "#64748b",
  slate200: "#e2e8f0",
  slate50: "#f8fafc",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    backgroundColor: COLORS.white,
  },
  // ─── CABEÇALHO (AUTORIDADE) ───
  headerBrandBar: {
    height: 4,
    backgroundColor: COLORS.primary,
    marginBottom: 20,
    borderRadius: 2,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  titleBlock: {
    maxWidth: "60%",
  },
  title: {
    fontSize: 18,
    fontWeight: "heavy",
    color: COLORS.slate950,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 10,
    marginTop: 4,
    color: COLORS.primary,
    fontWeight: "bold",
  },
  // ─── BLOCO DE METADADOS (CAIXA CLEAN) ───
  metaBox: {
    backgroundColor: COLORS.slate50,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    borderRadius: 4,
    padding: 10,
    width: "35%",
  },
  metaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  metaLabel: {
    color: COLORS.slate500,
    fontSize: 8,
    textTransform: "uppercase",
  },
  metaValue: {
    color: COLORS.slate950,
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
  },
  // ─── TABELA DE HORÁRIOS ───
  table: {
    borderWidth: 1,
    borderColor: COLORS.primary, // Borda externa com a cor da marca
    borderRadius: 4,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate200,
  },
  rowEven: {
    backgroundColor: COLORS.slate50, // Zebrado para legibilidade
  },
  // Cabeçalho da Tabela
  headerRow: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold, // Linha dourada a separar o cabeçalho
  },
  headerCell: {
    color: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
    textTransform: "uppercase",
    flexGrow: 1,
    flexBasis: 0,
    borderRightWidth: 1,
    borderRightColor: "rgba(255, 255, 255, 0.2)", // Separador subtil
  },
  // Células de Dados
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 8,
    color: COLORS.slate700,
    textAlign: "center",
    flexGrow: 1,
    flexBasis: 0,
    borderRightWidth: 1,
    borderRightColor: COLORS.slate200,
    justifyContent: "center",
  },
  cellTime: {
    minWidth: 70,
    flexGrow: 0,
    flexBasis: 70,
    fontWeight: "bold",
    color: COLORS.slate950,
    backgroundColor: COLORS.slate50,
  },
  cellNoBorder: {
    borderRightWidth: 0,
  },
  // ─── RODAPÉ ───
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.slate200,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: COLORS.slate500,
  },
  footerBrand: {
    fontSize: 7,
    color: COLORS.slate950,
    fontWeight: "bold",
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
        
        {/* Barra de Marca no Topo */}
        <View style={styles.headerBrandBar} />

        {/* Cabeçalho */}
        <View style={styles.headerContent}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{escola}</Text>
            <Text style={styles.subtitle}>Quadro de Horários Oficial</Text>
          </View>

          {/* Ficha Técnica (Box lateral) */}
          <View style={styles.metaBox}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Ano Letivo</Text>
              <Text style={styles.metaValue}>{anoLetivo || "—"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Curso</Text>
              <Text style={styles.metaValue}>{curso}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Classe / Turma</Text>
              <Text style={styles.metaValue}>{classe} • {turma}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Turno / Sala</Text>
              <Text style={styles.metaValue}>{turno} {sala ? `• ${sala}` : ""}</Text>
            </View>
          </View>
        </View>

        {/* Tabela Principal */}
        <View style={styles.table}>
          {/* Cabeçalho da Tabela */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.cellTime]}>Tempo</Text>
            {dias.map((dia, idx) => (
              <Text 
                key={dia} 
                style={[styles.headerCell, idx === dias.length - 1 ? styles.cellNoBorder : {}]}
              >
                {dia}
              </Text>
            ))}
          </View>

          {/* Corpo da Tabela (com Zebrado) */}
          {tempos.map((tempo, index) => {
            const isEven = index % 2 === 0;
            const isLastRow = index === tempos.length - 1;

            return (
              <View 
                key={tempo} 
                style={[
                  styles.row, 
                  isEven ? styles.rowEven : {}, 
                  isLastRow ? { borderBottomWidth: 0 } : {}
                ]}
              >
                <Text style={[styles.cell, styles.cellTime]}>{tempo}</Text>
                {grid[index]?.map((valor, colIndex) => {
                  const isLastCol = colIndex === dias.length - 1;
                  return (
                    <Text 
                      key={`${tempo}-${colIndex}`} 
                      style={[styles.cell, isLastCol ? styles.cellNoBorder : {}]}
                    >
                      {valor || "-"}
                    </Text>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* Rodapé Oficial */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Documento emitido em {generatedAt}
          </Text>
          <Text style={styles.footerBrand}>
            Powered by KLASSE
          </Text>
        </View>

      </Page>
    </Document>
  );
}