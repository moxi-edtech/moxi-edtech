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
  Tailwind,
  Hr,
} from "@react-email/components";

interface KlasseWelcomeEmailProps {
  nomeUsuario?: string;
  linkAcesso?: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const KlasseWelcomeEmail = ({
  nomeUsuario = "Gestor",
  linkAcesso = "https://klasse.ao/login",
}: KlasseWelcomeEmailProps) => {
  const previewText = "Bem-vindo ao KLASSE! Vamos começar sua escola.";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                klasse: {
                  green: "#1F6B3B",
                  gold: "#E3B23C",
                  slate: "#020617",
                },
              },
              fontFamily: {
                sans: ['"Sora"', "Helvetica", "Arial", "sans-serif"],
              },
            },
          },
        }}
      >
        <Body className="bg-slate-50 my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded-xl my-[40px] mx-auto p-[20px] max-w-[465px] bg-white shadow-sm">
            <Section className="mt-[32px]">
              <Img
                src={`${baseUrl}/static/klasse-logo.png`}
                width="120"
                height="40"
                alt="KLASSE Logo"
                className="my-0 mx-auto"
              />
            </Section>

            <Heading className="text-klasse-slate text-[24px] font-bold text-center p-0 my-[30px] mx-0">
              Bem-vindo(a) ao KLASSE! 🎉
            </Heading>

            <Text className="text-slate-600 text-[14px] leading-[24px]">
              Olá, <strong>{nomeUsuario}</strong>. Que bom ter você aqui.
            </Text>

            <Text className="text-slate-600 text-[14px] leading-[24px]">
              Para começar a usar sua escola, siga este roteiro simples:
            </Text>

            <Section className="bg-slate-50 p-4 rounded-lg my-6 border border-slate-100">
              <Text className="text-slate-500 text-[12px] font-bold uppercase tracking-wider m-0 mb-2">
                Primeiros passos do administrador:
              </Text>
              <ul className="text-slate-600 text-[13px] leading-[22px] pl-5 m-0">
                <li className="mb-1">Configurar o acadêmico (ano letivo, períodos e matriz curricular).</li>
                <li className="mb-1">Importar alunos pela Migração.</li>
                <li className="mb-1">Definir emolumentos na Tabela de Preços do Financeiro.</li>
                <li>Convidar professores para lançar notas.</li>
              </ul>
            </Section>

            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-klasse-gold rounded-xl text-klasse-slate text-[14px] font-bold no-underline text-center px-6 py-4 shadow-sm hover:bg-[#d4a02b] transition-all"
                href={linkAcesso}
              >
                Entrar no KLASSE
              </Button>
            </Section>

            <Text className="text-slate-500 text-[14px] leading-[24px]">
              Se tiver dúvidas técnicas, nossa equipe de suporte em Luanda está pronta para ajudar.
              Basta responder a este e-mail.
            </Text>

            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

            <Text className="text-[#666666] text-[12px] leading-[24px] text-center">
              © 2026 KLASSE EdTech. Luanda, Angola.
              <br />
              <Link href="https://klasse.ao" className="text-klasse-green no-underline font-medium">
                Termos de Uso
              </Link>
              {" • "}
              <Link href="https://klasse.ao" className="text-klasse-green no-underline font-medium">
                Privacidade
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default KlasseWelcomeEmail;
