import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type KlasseLifecycleReminderEmailProps = {
  title: string;
  previewText: string;
  centroNome: string;
  message: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  contactEmail?: string | null;
  contactWhatsapp?: string | null;
};

const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://klasse.ao";

export function KlasseLifecycleReminderEmail({
  title,
  previewText,
  centroNome,
  message,
  actionUrl,
  actionLabel = "Entrar no KLASSE",
  contactEmail,
  contactWhatsapp,
}: KlasseLifecycleReminderEmailProps) {
  const lines = message.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: "#f8fafc", margin: "0", padding: "24px 8px", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container style={{ border: "1px solid #eaeaea", borderRadius: "16px", margin: "40px auto", padding: "20px", maxWidth: "465px", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(15,23,42,0.08)" }}>
          <Section style={{ marginTop: "32px", textAlign: "center" }}>
            <Img
              src={`${baseUrl}/static/klasse-logo.png`}
              width="120"
              height="40"
              alt="KLASSE Logo"
              style={{ margin: "0 auto", display: "block" }}
            />
          </Section>

          <Heading style={{ color: "#020617", fontSize: "22px", fontWeight: "700", textAlign: "center", margin: "30px 0 18px" }}>
            {title}
          </Heading>

          <Text style={{ color: "#475569", fontSize: "14px", lineHeight: "24px" }}>
            Centro: <strong>{centroNome}</strong>
          </Text>

          <Section style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", margin: "20px 0", border: "1px solid #f1f5f9" }}>
            {lines.map((line, index) => (
              <Text key={`${line}-${index}`} style={{ color: "#475569", fontSize: "14px", lineHeight: "24px", margin: index === 0 ? "0" : "10px 0 0" }}>
                {line}
              </Text>
            ))}
          </Section>

          {actionUrl ? (
            <Section style={{ textAlign: "center", margin: "30px 0" }}>
              <Button
                href={actionUrl}
                style={{ backgroundColor: "#E3B23C", borderRadius: "12px", color: "#020617", fontSize: "14px", fontWeight: "700", textDecoration: "none", padding: "12px 24px", display: "inline-block" }}
              >
                {actionLabel}
              </Button>
            </Section>
          ) : null}

          {(contactEmail || contactWhatsapp) ? (
            <Section style={{ margin: "18px 0 0" }}>
              <Text style={{ color: "#64748b", fontSize: "13px", lineHeight: "22px", margin: "0" }}>
                Precisa de apoio comercial?
              </Text>
              {contactEmail ? (
                <Text style={{ color: "#64748b", fontSize: "13px", lineHeight: "22px", margin: "4px 0 0" }}>
                  E-mail: <Link href={`mailto:${contactEmail}`} style={{ color: "#1F6B3B", textDecoration: "none", fontWeight: "600" }}>{contactEmail}</Link>
                </Text>
              ) : null}
              {contactWhatsapp ? (
                <Text style={{ color: "#64748b", fontSize: "13px", lineHeight: "22px", margin: "4px 0 0" }}>
                  WhatsApp: <strong>{contactWhatsapp}</strong>
                </Text>
              ) : null}
            </Section>
          ) : null}

          <Hr style={{ border: "0", borderTop: "1px solid #eaeaea", margin: "26px 0", width: "100%" }} />

          <Text style={{ color: "#666666", fontSize: "12px", lineHeight: "24px", textAlign: "center" }}>
            © 2026 Moxi Soluções. Todos os direitos reservados.
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
}

export default KlasseLifecycleReminderEmail;
