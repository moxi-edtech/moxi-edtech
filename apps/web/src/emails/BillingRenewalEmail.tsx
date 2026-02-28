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
  Column,
  Row,
} from "@react-email/components";

interface BillingRenewalEmailProps {
  escolaNome: string;
  plano: string;
  valor: string;
  dataRenovacao: string;
  diasRestantes: number;
  referencia: string;
  linkPagamento: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://moxi-edtech.vercel.app"; // Fallback URL

export const BillingRenewalEmail = ({
  escolaNome = "Director(a)",
  plano = "Profissional",
  valor = "Kz 120.000",
  dataRenovacao = "28 de Março, 2026",
  diasRestantes = 7,
  referencia = "KLASSE-PRO-0042",
  linkPagamento = "https://klasse.ao/assinatura",
}: BillingRenewalEmailProps) => {
  const previewText = `A sua subscrição KLASSE vence em ${diasRestantes} dias.`;

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
            <Section className="mt-[32px] text-center">
              <Img
                src={`${baseUrl}/static/klasse-logo.png`}
                width="120"
                height="40"
                alt="KLASSE Logo"
                className="my-0 mx-auto"
              />
            </Section>

            <Heading className="text-klasse-slate text-[22px] font-bold text-center p-0 my-[30px] mx-0">
              {diasRestantes === 1 ? "⚠️ Último dia de subscrição!" : `A sua subscrição vence em ${diasRestantes} dias`}
            </Heading>

            <Text className="text-slate-600 text-[14px] leading-[24px]">
              Olá, <strong>{escolaNome}</strong>.
            </Text>

            <Text className="text-slate-600 text-[14px] leading-[24px]">
              Vimos por este meio avisar que a subscrição do plano <strong>{plano}</strong> da sua escola
              expira em <strong>{dataRenovacao}</strong>.
            </Text>

            <Section className="bg-slate-50 p-5 rounded-xl my-6 border border-slate-100">
              <Row className="mb-4 border-b border-slate-200 pb-2">
                <Column>
                  <Text className="m-0 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Valor a pagar</Text>
                  <Text className="m-0 text-klasse-slate text-[16px] font-bold">{valor}</Text>
                </Column>
                <Column className="text-right">
                  <Text className="m-0 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Referência</Text>
                  <Text className="m-0 text-slate-700 text-[14px] font-mono font-bold">{referencia}</Text>
                </Column>
              </Row>

              <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest m-0 mb-3">Dados para Transferência</Text>
              
              <div className="space-y-3">
                <Row className="mb-2">
                  <Column>
                    <Text className="m-0 text-slate-400 text-[11px] uppercase">Banco</Text>
                    <Text className="m-0 text-slate-700 text-[13px] font-bold">Standard Bank Angola</Text>
                  </Column>
                </Row>
                <Row>
                  <Column>
                    <Text className="m-0 text-slate-400 text-[11px] uppercase">NIB</Text>
                    <Text className="m-0 text-klasse-green text-[15px] font-mono font-bold tracking-wider">0040.0000.1234.5678.9012.3</Text>
                  </Column>
                </Row>
              </div>
            </Section>

            <Section className="text-center mt-[32px] mb-[12px]">
              <Button
                className="bg-klasse-gold rounded-xl text-klasse-slate text-[14px] font-bold no-underline text-center px-6 py-4 shadow-sm"
                href={linkPagamento}
              >
                Submeter Comprovativo
              </Button>
            </Section>

            <Text className="text-slate-500 text-[12px] leading-[18px] text-center">
              Para evitar interrupções no acesso ao portal da sua escola, por favor efectue o pagamento e submeta o comprovativo na área de configurações.
            </Text>

            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

            <Text className="text-[#666666] text-[12px] leading-[24px] text-center italic">
              Se já efectuou o pagamento e submeteu o comprovativo, por favor ignore este email. Estamos em processo de validação.
            </Text>

            <Text className="text-[#666666] text-[12px] leading-[24px] text-center mt-4">
              © 2026 KLASSE EdTech. Luanda, Angola.
              <br />
              Suporte em Luanda: <strong>+244 9XX XXX XXX</strong>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default BillingRenewalEmail;
