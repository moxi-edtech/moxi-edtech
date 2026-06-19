import React from "react";
import { Document, Page, StyleSheet, Text, View, Image } from "@react-pdf/renderer";
import type { CertificadoSnapshot as CertificadoSnapshotType } from "@/lib/documentos/certificadoSnapshot";
import { clean } from "@/lib/documentos/snapshotUtils";

export type CertificadoSnapshot = CertificadoSnapshotType;

const s = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingHorizontal: 22,
    paddingBottom: 18,
    fontSize: 9,
    fontFamily: "Times-Roman",
    backgroundColor: "#fff",
  },
  frame: {
    borderWidth: 1,
    borderColor: "#7c7c7c",
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 12,
    minHeight: 605,
  },
  header: {
    alignItems: "center",
    marginBottom: 10,
  },
  republicText: {
    fontSize: 10,
    fontFamily: "Times-Roman",
  },
  ministryText: {
    fontSize: 10,
    fontFamily: "Times-Bold",
    marginTop: 1,
  },
  cycleText: {
    fontSize: 8,
    marginTop: 10,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 10,
    fontSize: 18,
    fontFamily: "Times-Bold",
    textTransform: "uppercase",
  },
  paragraph: {
    marginTop: 12,
    fontSize: 8.8,
    lineHeight: 1.38,
    textAlign: "justify",
  },
  paragraphLead: {
    fontFamily: "Times-BoldItalic",
  },
  paragraphStrong: {
    fontFamily: "Times-Bold",
  },
  table: {
    marginTop: 10,
    width: "100%",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#1f2937",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#1f2937",
    minHeight: 19,
    alignItems: "stretch",
  },
  headerRow: {
    backgroundColor: "#f3f4f6",
    minHeight: 22,
  },
  cell: {
    borderRightWidth: 1,
    borderColor: "#1f2937",
    paddingHorizontal: 3,
    paddingVertical: 2,
    justifyContent: "center",
    fontSize: 7.2,
    textAlign: "center",
  },
  cellText: {
    fontSize: 7.2,
    textAlign: "center",
  },
  leftCellText: {
    fontSize: 7.2,
    textAlign: "left",
  },
  bodyText: {
    fontSize: 8.8,
    lineHeight: 1.4,
    textAlign: "justify",
  },
  legalParagraph: {
    marginTop: 14,
    fontSize: 8.6,
    lineHeight: 1.4,
    textAlign: "justify",
  },
  emissionLine: {
    marginTop: 24,
    fontSize: 8.4,
    textAlign: "center",
  },
  signatures: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  signatureCard: {
    width: 165,
    borderWidth: 1,
    borderColor: "#1f2937",
    minHeight: 58,
    paddingTop: 6,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: "center",
  },
  signatureTitle: {
    fontSize: 8.5,
    fontFamily: "Times-Bold",
    marginBottom: 18,
  },
  signatureLine: {
    width: "82%",
    borderBottomWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 3,
  },
  signatureName: {
    fontSize: 7.5,
    textAlign: "center",
  },
  validationBlock: {
    width: 122,
    alignItems: "center",
    paddingTop: 2,
  },
  qrImage: {
    width: 56,
    height: 56,
    marginBottom: 4,
  },
  validationText: {
    fontSize: 6.6,
    textAlign: "center",
    lineHeight: 1.2,
  },
  footerLine: {
    marginTop: 6,
    fontSize: 6.4,
    textAlign: "center",
    color: "#4b5563",
  },
});

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const formatNote = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const capitalize = (value?: string | null) => {
  const normalized = clean(value);
  if (!normalized) return "—";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatDateLong = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = MONTHS[parsed.getMonth()] ?? MONTHS[0];
  const year = parsed.getFullYear();
  return `${day} de ${month} de ${year}`;
};

function buildHeaderSubtitle(item: CertificadoSnapshot) {
  const cycle = clean(item.ciclo_designacao);
  return cycle ?? "I CICLO DO ENSINO SECUNDÁRIO GERAL";
}

function buildMainParagraph(item: CertificadoSnapshot) {
  const director = clean(item.diretora_nome) ?? "________________________________";
  const school = clean(item.escola_nome) ?? "________________________________";
  const schoolCode = clean(item.escola_codigo);
  const student = clean(item.aluno_nome) ?? "________________________________";
  const father = clean(item.pai_nome);
  const mother = clean(item.mae_nome);
  const filiation =
    father || mother ? `, filho(a) de ${father ?? "—"} e de ${mother ?? "—"}` : "";
  const birthDate = formatDateLong(item.data_nascimento);
  const birth = birthDate ? `, nascido(a) em ${birthDate}` : "";
  const naturalidade = clean(item.naturalidade);
  const provincia = clean(item.provincia);
  const origem = naturalidade
    ? `, natural de ${naturalidade}${provincia ? `, Província de ${provincia}` : ""}`
    : "";
  const bi = clean(item.aluno_bi) ? `, portador(a) do B.I. n.º ${clean(item.aluno_bi)}` : "";
  const biIssueDate = formatDateLong(item.bi_emitido_em);
  const biIssued = biIssueDate ? `, emitido em ${biIssueDate}` : "";
  const process = clean(item.processo_individual_numero)
    ? `, conforme processo individual n.º ${clean(item.processo_individual_numero)}`
    : "";
  const schoolLabel = schoolCode ? `${school} n.º ${schoolCode}` : school;
  const cycle = buildHeaderSubtitle(item);
  const schoolYear = item.ano_letivo != null ? String(item.ano_letivo) : "—";
  const overallMedia = formatNote(item.media_final);
  const overallMediaExtenso = capitalize(item.media_extenso);

  return (
    <>
      <Text style={s.paragraphLead}>a)/</Text>
      <Text style={s.bodyText}>
        <Text style={s.paragraphStrong}>{director}</Text>, Director(a) da{" "}
        <Text style={s.paragraphStrong}>{schoolLabel}</Text>, certifica que{" "}
        <Text style={s.paragraphStrong}>{student}</Text>
        {filiation}
        {birth}
        {origem}
        {bi}
        {biIssued}
        {process}, concluiu no ano lectivo de{" "}
        <Text style={s.paragraphStrong}>{schoolYear}</Text>, o{" "}
        <Text style={s.paragraphStrong}>{cycle}</Text>, com a média final de{" "}
        <Text style={s.paragraphStrong}>{overallMedia}</Text> ({overallMediaExtenso}) valores,
        obtida nas seguintes classificações por ciclos de aprendizagem:
      </Text>
    </>
  );
}

function buildLegalParagraph(item: CertificadoSnapshot) {
  const documentNumber =
    item.numero_sequencial != null && String(item.numero_sequencial).trim().length > 0
      ? String(item.numero_sequencial)
      : "—";

  return `Para efeitos legais lhe é passado o presente CERTIFICADO, registado sob o documento n.º ${documentNumber}, assinado por mim e autenticado com o selo branco em uso neste estabelecimento de ensino.`;
}

function buildEmissionLine(item: CertificadoSnapshot) {
  const local =
    clean(item.escola_municipio) ??
    clean(item.escola_provincia) ??
    clean(item.provincia) ??
    "Luanda";
  const data = formatDateLong(item.data_emissao) ?? formatDateLong(new Date().toISOString()) ?? "—";
  return `${local}, aos ${data}.`;
}

function buildValidationLine(item: CertificadoSnapshot) {
  const number =
    item.numero_sequencial != null && String(item.numero_sequencial).trim().length > 0
      ? `N.º ${String(item.numero_sequencial)}`
      : "N.º —";
  const hash = clean(item.hash_validacao);
  return hash ? `${number} • ${hash.slice(0, 12)}` : number;
}

export function CertificadoBatchV1({ snapshots }: { snapshots: CertificadoSnapshot[] }) {
  return (
    <Document>
      {snapshots.map((item, idx) => (
        <Page key={`${item.aluno_nome}-${idx}`} size="A4" style={s.page}>
          <View style={s.frame}>
            <View style={s.header}>
              <Text style={s.republicText}>REPÚBLICA DE ANGOLA</Text>
              <Text style={s.ministryText}>MINISTÉRIO DA EDUCAÇÃO</Text>
              <Text style={s.cycleText}>{buildHeaderSubtitle(item)}</Text>
              <Text style={s.title}>CERTIFICADO</Text>
            </View>

            <Text style={s.paragraph}>{buildMainParagraph(item)}</Text>

            <View style={s.table}>
              <View style={[s.row, s.headerRow]}>
                <View style={[s.cell, { width: "38%" }]}>
                  <Text style={s.cellText}>Disciplinas</Text>
                </View>
                {item.colunas.map((coluna) => (
                  <View key={coluna.key} style={[s.cell, { width: "8%" }]}>
                    <Text style={s.cellText}>{coluna.label.replace(".a", ".ª")}</Text>
                  </View>
                ))}
                <View style={[s.cell, { width: "14%" }]}>
                  <Text style={s.cellText}>Média Final</Text>
                </View>
                <View style={[s.cell, { width: "24%" }]}>
                  <Text style={s.cellText}>Média por Extenso</Text>
                </View>
              </View>

              {item.disciplinas.length > 0 ? (
                item.disciplinas.map((disciplina, rowIdx) => (
                  <View key={`${disciplina.nome}-${rowIdx}`} style={s.row}>
                    <View style={[s.cell, { width: "38%", alignItems: "flex-start" }]}>
                      <Text style={s.leftCellText}>{disciplina.nome}</Text>
                    </View>
                    {item.colunas.map((coluna) => (
                      <View key={`${disciplina.nome}-${coluna.key}`} style={[s.cell, { width: "8%" }]}>
                        <Text style={s.cellText}>{formatNote(disciplina.notas[coluna.key])}</Text>
                      </View>
                    ))}
                    <View style={[s.cell, { width: "14%" }]}>
                      <Text style={s.cellText}>{formatNote(disciplina.media_final)}</Text>
                    </View>
                    <View style={[s.cell, { width: "24%" }]}>
                      <Text style={s.cellText}>{capitalize(disciplina.media_extenso)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={s.row}>
                  <View style={[s.cell, { width: "100%", minHeight: 24 }]}>
                    <Text style={s.cellText}>Sem classificações históricas disponíveis para este certificado.</Text>
                  </View>
                </View>
              )}
            </View>

            <Text style={s.legalParagraph}>{buildLegalParagraph(item)}</Text>
            <Text style={s.emissionLine}>{buildEmissionLine(item)}</Text>
          </View>

          <View style={s.signatures}>
            <View style={s.signatureCard}>
              <Text style={s.signatureTitle}>Conferido por</Text>
              <View style={s.signatureLine} />
            </View>

            <View style={s.signatureCard}>
              <Text style={s.signatureTitle}>O Director</Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureName}>{clean(item.diretora_nome) ?? "________________________"}</Text>
            </View>

            <View style={s.validationBlock}>
              {item.qrCodeDataUrl ? <Image src={item.qrCodeDataUrl} style={s.qrImage} /> : null}
              <Text style={s.validationText}>Validação digital KLASSE</Text>
              <Text style={s.validationText}>{buildValidationLine(item)}</Text>
            </View>
          </View>

          <Text style={s.footerLine}>
            Documento oficial emitido digitalmente pelo sistema KLASSE.
          </Text>
        </Page>
      ))}
    </Document>
  );
}
