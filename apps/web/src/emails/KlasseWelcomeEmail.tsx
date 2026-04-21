import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";

interface KlasseWelcomeEmailProps {
  nomeUsuario?: string;
  linkAcesso?: string;
  escolaNome?: string;
  plano?: string | null;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const KlasseWelcomeEmail = ({
  nomeUsuario = "Gestor",
  linkAcesso = "https://klasse.ao/login",
  escolaNome = "sua escola",
  plano = null,
}: KlasseWelcomeEmailProps) => {
  const previewText = "Bem-vindo ao KLASSE! Vamos começar sua escola.";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: "#f8fafc", margin: "0", padding: "24px 8px", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container style={{ border: "1px solid #eaeaea", borderRadius: "16px", margin: "40px auto", padding: "20px", maxWidth: "465px", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(15,23,42,0.08)" }}>
          <Section style={{ marginTop: "32px" }}>
            <Img
              src={`${baseUrl}/static/klasse-logo.png`}
              width="120"
              height="40"
              alt="KLASSE Logo"
              style={{ margin: "0 auto", display: "block" }}
            />
          </Section>

          <Heading style={{ color: "#020617", fontSize: "24px", fontWeight: "700", textAlign: "center", margin: "30px 0" }}>
            Bem-vindo(a) ao KLASSE! 🎉
          </Heading>

          <Text style={{ color: "#475569", fontSize: "14px", lineHeight: "24px" }}>
            Olá, <strong>{nomeUsuario}</strong>. Que bom ter você aqui.
          </Text>

          <Text style={{ color: "#475569", fontSize: "14px", lineHeight: "24px" }}>
            Escola: <strong>{escolaNome}</strong>{plano ? <> • Plano: <strong>{plano}</strong></> : null}
          </Text>

          <Text style={{ color: "#475569", fontSize: "14px", lineHeight: "24px" }}>
            Para começar a usar sua escola, siga este roteiro simples:
          </Text>

          <Section style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", margin: "24px 0", border: "1px solid #f1f5f9" }}>
            <Text style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
              Primeiros passos do administrador:
            </Text>
            <ul style={{ color: "#475569", fontSize: "13px", lineHeight: "22px", paddingLeft: "20px", margin: "0" }}>
              <li style={{ marginBottom: "4px" }}>Configurar o acadêmico (ano letivo, períodos e matriz curricular).</li>
              <li style={{ marginBottom: "4px" }}>Importar alunos pela Migração.</li>
              <li style={{ marginBottom: "4px" }}>Definir emolumentos na Tabela de Preços do Financeiro.</li>
              <li>Convidar professores para lançar notas.</li>
            </ul>
          </Section>

          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={linkAcesso}
              style={{ backgroundColor: "#E3B23C", borderRadius: "12px", color: "#020617", fontSize: "14px", fontWeight: "700", textDecoration: "none", padding: "12px 24px", display: "inline-block" }}
            >
              Entrar no KLASSE
            </Button>
          </Section>

          <Text style={{ color: "#64748b", fontSize: "14px", lineHeight: "24px" }}>
            Se tiver dúvidas técnicas, nossa equipe de suporte em Luanda está pronta para ajudar.
            Basta responder a este e-mail.
          </Text>

          <Hr style={{ border: "0", borderTop: "1px solid #eaeaea", margin: "26px 0", width: "100%" }} />

          <Text style={{ color: "#666666", fontSize: "12px", lineHeight: "24px", textAlign: "center" }}>
            © 2026 KLASSE EdTech. Luanda, Angola.
            <br />
            <Link href="https://klasse.ao" style={{ color: "#1F6B3B", textDecoration: "none", fontWeight: "600" }}>
              Termos de Uso
            </Link>
            {" • "}
            <Link href="https://klasse.ao" style={{ color: "#1F6B3B", textDecoration: "none", fontWeight: "600" }}>
              Privacidade
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default KlasseWelcomeEmail;
