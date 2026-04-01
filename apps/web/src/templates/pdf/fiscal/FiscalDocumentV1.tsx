import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface FiscalPdfItem {
  id: string;
  codigo: string;
  descricao: string;
  precoUnitario: number;
  quantidade: number;
  taxaIva: number;
  motivoIsencaoCode?: string;
  total: number;
}

export interface FiscalPdfDocumentData {
  tipoDocumento: string;
  numeroDocumento: string;
  dataEmissao: string;
  status: "DRAFT" | "ASSINADO" | "ANULADO";
  empresa: {
    nome: string;
    nif: string;
    morada: string;
  };
  cliente: {
    nome: string;
    nif: string;
    morada: string;
  };
  itens: FiscalPdfItem[];
  totais: {
    incidencia: number;
    imposto: number;
    totalGeral: number;
  };
  moeda: string;
}

export interface FiscalDocumentV1Props {
  documento: FiscalPdfDocumentData;
  assinaturaCurta: string;
  agtNumber: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#020617" },
  watermarkContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.11,
  },
  watermarkText: {
    fontSize: 52,
    color: "#ef4444",
    transform: "rotate(-45deg)",
    textTransform: "uppercase",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  companyBlock: { width: "53%" },
  clientBlock: { width: "44%", backgroundColor: "#f8fafc", padding: 10, borderRadius: 4 },
  title: { fontSize: 16, color: "#1F6B3B", marginBottom: 4, fontFamily: "Helvetica-Bold" },
  bold: { fontFamily: "Helvetica-Bold" },
  mono: { fontFamily: "Courier", fontSize: 9 },
  sectionMeta: { marginBottom: 16 },
  table: { width: "100%", marginTop: 14 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
  },
  colCodigo: { width: "15%" },
  colDescricao: { width: "38%" },
  colPreco: { width: "15%", textAlign: "right" },
  colQtd: { width: "10%", textAlign: "right" },
  colIva: { width: "10%", textAlign: "right" },
  colTotal: { width: "12%", textAlign: "right" },
  totalsBlock: { marginTop: 16, width: "44%", alignSelf: "flex-end" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#020617",
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 10,
    fontSize: 8,
    color: "#475569",
  },
  agtHashBlock: { marginTop: 6 },
});

const TITULOS_POR_TIPO: Record<string, string> = {
  FT: "Fatura",
  FR: "Fatura-Recibo",
  NC: "Nota de Crédito",
  ND: "Nota de Débito",
  RC: "Recibo",
  PP: "Fatura Pró-Forma",
  FG: "Fatura Global",
  GF: "Fatura Genérica",
  GR: "Guia de Remessa",
  GT: "Guia de Transporte",
};

const ISENCAO_LABELS: Record<string, string> = {
  M00: "Regime Transitório",
  M02: "Transmissão de bens e serviço não sujeita",
  M04: "IVA - Regime de não Sujeição",
  M07: "Isenção de IVA",
  M11: "Isento Artigo 12.º b) do CIVA",
  M12: "Isento Artigo 12.º c) do CIVA",
  M13: "Isento Artigo 12.º d) do CIVA",
  M14: "Isento Artigo 12.º e) do CIVA",
  M15: "Isento Artigo 12.º f) do CIVA",
  M17: "Isento Artigo 12.º h) do CIVA",
  M18: "Isento Artigo 12.º i) do CIVA",
  M19: "Isento Artigo 12.º j) do CIVA",
  M20: "Isento Artigo 12.º k) do CIVA",
  M30: "Isento Artigo 15.º 1 a) do CIVA",
  M31: "Isento Artigo 15.º 1 b) do CIVA",
  M32: "Isento Artigo 15.º 1 c) do CIVA",
  M33: "Isento Artigo 15.º 1 d) do CIVA",
  M34: "Isento Artigo 15.º 1 e) do CIVA",
  M35: "Isento Artigo 15.º 1 f) do CIVA",
  M36: "Isento Artigo 15.º 1 g) do CIVA",
  M37: "Isento Artigo 15.º 1 h) do CIVA",
  M38: "Isento Artigo 15.º 1 i) do CIVA",
};

function formatCurrencyDeterministic(value: number, currency: string): string {
  const normalized = Number.isFinite(value) ? value : 0;
  const sign = normalized < 0 ? "-" : "";
  const abs = Math.abs(normalized);
  const fixed = abs.toFixed(2);
  const [integerRaw, decimal] = fixed.split(".");
  const integer = integerRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${integer},${decimal} ${currency}`;
}

function uniqueIsencoes(items: FiscalPdfItem[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const code = item.motivoIsencaoCode?.trim().toUpperCase();
    if (item.taxaIva === 0 && code) seen.add(code);
  }
  return Array.from(seen.values());
}

export function FiscalDocumentV1({ documento, assinaturaCurta, agtNumber }: FiscalDocumentV1Props) {
  const isDraft = documento.status === "DRAFT";
  const isAnulado = documento.status === "ANULADO";
  const isencoes = uniqueIsencoes(documento.itens);
  const tituloDocumento = TITULOS_POR_TIPO[documento.tipoDocumento] ?? "Documento Fiscal";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {(isDraft || isAnulado) ? (
          <View style={styles.watermarkContainer}>
            <Text style={styles.watermarkText}>
              {isDraft ? "RASCUNHO - NÃO SERVE DE FATURA" : "ANULADA"}
            </Text>
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <View style={styles.companyBlock}>
            <Text style={styles.title}>{documento.empresa.nome}</Text>
            <Text>NIF: {documento.empresa.nif}</Text>
            <Text>{documento.empresa.morada}</Text>
          </View>

          <View style={styles.clientBlock}>
            <Text style={styles.bold}>Exmo(s) Sr(s):</Text>
            <Text>{documento.cliente.nome}</Text>
            <Text>NIF: {documento.cliente.nif}</Text>
            <Text>{documento.cliente.morada}</Text>
          </View>
        </View>

        <View style={styles.sectionMeta}>
          <Text style={styles.title}>
            {tituloDocumento} n.º {documento.numeroDocumento}
          </Text>
          <Text>Data de Emissão: {documento.dataEmissao}</Text>
          {!isDraft && !isAnulado ? <Text style={styles.bold}>Original</Text> : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colCodigo}>Código</Text>
            <Text style={styles.colDescricao}>Descrição</Text>
            <Text style={styles.colPreco}>Pr. Unitário</Text>
            <Text style={styles.colQtd}>Qtd.</Text>
            <Text style={styles.colIva}>IVA</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>

          {documento.itens.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={{ ...styles.colCodigo, ...styles.mono }}>{item.codigo}</Text>
              <Text style={styles.colDescricao}>{item.descricao}</Text>
              <Text style={{ ...styles.colPreco, ...styles.mono }}>
                {formatCurrencyDeterministic(item.precoUnitario, documento.moeda)}
              </Text>
              <Text style={{ ...styles.colQtd, ...styles.mono }}>{item.quantidade.toFixed(2)}</Text>
              <Text style={{ ...styles.colIva, ...styles.mono }}>
                {item.taxaIva.toFixed(2)}%
                {item.taxaIva === 0 && item.motivoIsencaoCode ? ` (${item.motivoIsencaoCode})` : ""}
              </Text>
              <Text style={{ ...styles.colTotal, ...styles.mono }}>
                {formatCurrencyDeterministic(item.total, documento.moeda)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text>Valor Base:</Text>
            <Text style={styles.mono}>{formatCurrencyDeterministic(documento.totais.incidencia, documento.moeda)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Total Imposto:</Text>
            <Text style={styles.mono}>{formatCurrencyDeterministic(documento.totais.imposto, documento.moeda)}</Text>
          </View>
          <View style={styles.totalTotal}>
            <Text style={styles.bold}>Total a Pagar:</Text>
            <Text style={{ ...styles.bold, ...styles.mono }}>
              {formatCurrencyDeterministic(documento.totais.totalGeral, documento.moeda)}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          {isencoes.length > 0 ? (
            <View>
              <Text style={styles.bold}>Motivos de Isenção:</Text>
              {isencoes.map((code) => (
                <Text key={code}>
                  {code} - {ISENCAO_LABELS[code] ?? "Isenção conforme legislação aplicável."}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.agtHashBlock}>
            <Text style={styles.bold}>
              {assinaturaCurta} - Processado por programa validado n.º {agtNumber}/AGT
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

