import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";

// Registro de fontes (usando fontes padrão por enquanto)
// Nota: Em produção, registrar fontes customizadas para melhor branding.

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1e293b",
  },
  header: {
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "black",
    color: "#C8902A", // Cor da marca (Klasse Gold)
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    backgroundColor: "#f8fafc",
    padding: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#C8902A",
  },
  row: {
    flexDirection: "row",
    marginBottom: 6,
  },
  label: {
    width: 100,
    color: "#64748b",
    fontWeight: "bold",
  },
  value: {
    flex: 1,
    color: "#0f172a",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 10,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 8,
  },
  verificationCode: {
    marginTop: 10,
    fontSize: 7,
    fontFamily: "Courier",
  },
});

export type InscricaoData = {
  escola: {
    nome: string;
    nif?: string;
    endereco?: string;
    telefone?: string;
  };
  formando: {
    nome: string;
    email?: string;
    bi_numero?: string;
    telefone?: string;
  };
  inscricao: {
    id: string;
    referencia?: string;
    created_at: string;
    modalidade?: string;
    origem?: string;
    status: string;
  };
  cohort: {
    codigo: string;
    nome: string;
    curso_nome: string;
    data_inicio: string;
    data_fim: string;
  };
};

export const InscricaoComprovativoTemplate = ({ data }: { data: InscricaoData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{data.escola.nome}</Text>
          <Text style={styles.subtitle}>Centro de Formação Profissional</Text>
        </View>
        <View style={{ textAlign: "right" }}>
          <Text style={{ fontWeight: "bold" }}>COMPROVATIVO DE INSCRIÇÃO</Text>
          <Text style={styles.subtitle}>Ref: {data.inscricao.referencia || data.inscricao.id.slice(0, 8).toUpperCase()}</Text>
        </View>
      </View>

      {/* Dados do Formando */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dados do Formando</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Nome Completo:</Text>
          <Text style={styles.value}>{data.formando.nome}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Bilhete Identidade:</Text>
          <Text style={styles.value}>{data.formando.bi_numero || "N/A"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{data.formando.email || "N/A"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Telefone:</Text>
          <Text style={styles.value}>{data.formando.telefone || "N/A"}</Text>
        </View>
      </View>

      {/* Dados Académicos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dados da Formação</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Curso:</Text>
          <Text style={styles.value}>{data.cohort.curso_nome}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Turma / Edição:</Text>
          <Text style={styles.value}>{data.cohort.nome} ({data.cohort.codigo})</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Data Início:</Text>
          <Text style={styles.value}>{new Date(data.cohort.data_inicio).toLocaleDateString("pt-AO")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Data Fim:</Text>
          <Text style={styles.value}>{new Date(data.cohort.data_fim).toLocaleDateString("pt-AO")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Modalidade:</Text>
          <Text style={styles.value}>{data.inscricao.modalidade || "Presencial"}</Text>
        </View>
      </View>

      {/* Status e Datas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado da Matrícula</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Estado:</Text>
          <Text style={styles.value}>{data.inscricao.status.toUpperCase()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Data Inscrição:</Text>
          <Text style={styles.value}>{new Date(data.inscricao.created_at).toLocaleString("pt-AO")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Canal Entrada:</Text>
          <Text style={styles.value}>{data.inscricao.origem || "Balcão"}</Text>
        </View>
      </View>

      {/* Rodapé */}
      <View style={styles.footer}>
        <Text>{data.escola.nome} {data.escola.nif ? `· NIF: ${data.escola.nif}` : ""} {data.escola.endereco ? `· ${data.escola.endereco}` : ""}</Text>
        <Text style={{ marginTop: 4 }}>Este documento é um comprovativo eletrônico de inscrição na plataforma KLASSE.</Text>
        <Text style={styles.verificationCode}>Hash de Verificação: {data.inscricao.id}</Text>
      </View>
    </Page>
  </Document>
);
