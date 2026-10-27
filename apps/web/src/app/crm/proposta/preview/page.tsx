"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  formatKz,
  formatNumber,
  proposalPrintErrors,
  PROPOSAL_PLANS,
  readProposalParams,
} from "@/lib/crm/commercial-proposal";

const CORE_PORTALS = [
  ["Secretaria", "Matrículas, alunos, turmas, documentos e rotinas administrativas."],
  ["Professor", "Turmas, frequência, avaliações e lançamento de notas."],
  ["Aluno", "Acompanhamento académico, frequência, avaliações e documentos disponibilizados."],
  ["Direção", "Visão consolidada dos processos académicos, administrativos e financeiros."],
] as const;

const CORE_FEATURES = [
  "Gestão de alunos, responsáveis, turmas e professores.",
  "Matrículas e organização do ano letivo.",
  "Gestão financeira de propinas e pagamentos, com identificação de pendências.",
  "Frequência, avaliações e acompanhamento académico.",
  "Emissão e consulta de documentos e relatórios disponíveis no plano contratado.",
  "Perfis de acesso e permissões de utilizadores conforme a função.",
];

function Section({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <section className="proposal-section border-t border-slate-200 pt-5 mt-6">
      <h2 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#1F6B3B] mb-3">
        {index}. {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ title, value }: { title: string; value: string }) {
  return (
    <p className="text-[11px] leading-[1.65] text-slate-700">
      <span className="font-bold text-slate-800">{title}:</span> {value}
    </p>
  );
}

function Signature({ title, role }: { title: string; role: string }) {
  return (
    <div className="proposal-keep break-inside-avoid">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#1F6B3B] mb-3">{title}</p>
      <p className="text-[11px] leading-7">Nome: __________________________________</p>
      <p className="text-[11px] leading-7">{role}: __________________________________</p>
      <p className="text-[11px] leading-7">Data: ____ / ____ / ______</p>
      <p className="text-[11px] leading-7">Assinatura: ______________________________</p>
    </div>
  );
}

function ProposalPreviewContent() {
  const params = useSearchParams();
  const proposal = readProposalParams(new URLSearchParams(params?.toString() || ""));
  const errors = proposalPrintErrors(proposal);
  const [issuedOn, setIssuedOn] = useState("");

  useEffect(() => {
    setIssuedOn(new Date().toLocaleDateString("pt-AO"));
  }, []);

  const plan = proposal.plano ? PROPOSAL_PLANS[proposal.plano] : null;
  const valorInicial = proposal.taxa !== null && proposal.mensalidade !== null
    ? proposal.taxa + proposal.mensalidade
    : null;
  const canPrint = errors.length === 0 && Boolean(issuedOn);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-7 text-slate-800 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
        <Button type="button" variant="outline" onClick={() => window.close()} className="h-9 rounded-xl border-slate-200 text-xs font-semibold">
          <ArrowLeft size={16} className="mr-2" /> Voltar ao CRM
        </Button>
        <Button type="button" disabled={!canPrint} onClick={() => window.print()} className="h-9 rounded-xl border-0 bg-[#E3B23C] text-white text-xs font-bold hover:brightness-95">
          <Printer size={16} className="mr-2" /> Imprimir / guardar PDF
        </Button>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="mx-auto mb-5 max-w-[210mm] rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 print:hidden">
          <div className="flex items-center gap-2 font-bold mb-2"><AlertCircle size={16} /> Complete os dados no CRM antes de imprimir</div>
          <ul className="list-disc pl-5 space-y-1">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}

      <main className="commercial-proposal mx-auto w-full max-w-[210mm] rounded-xl bg-white px-9 py-10 shadow-sm print:w-auto print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        {errors.length > 0 && (
          <p className="proposal-keep mb-5 border-2 border-red-300 p-3 text-center text-[11px] font-extrabold uppercase tracking-wide text-red-700">
            Rascunho incompleto — não utilizar como proposta emitida
          </p>
        )}

        <header className="proposal-keep border-b-2 border-[#E3B23C] pb-5 text-center">
          <p className="text-[22px] font-extrabold tracking-[0.14em] text-[#1F6B3B]">KLASSE</p>
          <h1 className="mt-2 text-[21px] font-extrabold uppercase tracking-tight text-[#1F6B3B]">Proposta Comercial</h1>
          <p className="mt-1 text-[12px] font-semibold text-slate-500">Plataforma de Gestão Escolar KLASSE</p>
        </header>

        <div className="proposal-keep mt-5 rounded-lg border-l-[3px] border-[#1F6B3B] bg-[#F5F9F6] px-5 py-4">
          <Field title="Escola" value={proposal.escola || "Por confirmar"} />
          <Field title="Responsável" value={proposal.contacto || "A confirmar na reunião"} />
          <Field title="N.º aproximado de alunos" value={proposal.alunos !== null ? formatNumber(proposal.alunos) : "Por confirmar"} />
          <Field title="Plano" value={plan?.label.toUpperCase() || "Por confirmar"} />
          <Field title="Data" value={issuedOn || "A gerar"} />
          <Field title="Validade da proposta" value="15 dias corridos a partir da emissão" />
        </div>

        <Section index={1} title="Objetivo">
          <p className="text-[11px] leading-[1.7]">
            A KLASSE propõe apoiar a transição da escola para uma gestão integrada e digital,
            centralizando processos académicos, administrativos e financeiros e reduzindo a dependência
            de planilhas, retrabalho e controlos dispersos.
          </p>
          {plan && (
            <div className="proposal-keep mt-4 rounded-lg border border-emerald-100 bg-[#F5F9F6] p-4">
              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[#1F6B3B]">
                Benefícios do plano {plan.label}
              </p>
              <p className="text-[11px] font-bold">
                {plan.alunos === null ? "Alunos sem limite contratual padrão" : "Até " + formatNumber(plan.alunos) + " alunos"}
                {"  ·  "}
                {plan.utilizadores === null ? "Utilizadores conforme contrato" : "Até " + formatNumber(plan.utilizadores) + " utilizadores"}
                {"  ·  "}{plan.storage}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed">
                Portais do Aluno, Professor, Secretaria e Direção · Documentos MED incluídos · {plan.network}.
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {plan.suporte}. Condições anuais e eventuais descontos dependem de proposta específica.
              </p>
            </div>
          )}
        </Section>

        <Section index={2} title="Escopo da solução">
          <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-700">Portais incluídos</h3>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 print:grid-cols-2">
            {CORE_PORTALS.map(([title, description]) => (
              <p key={title} className="text-[10px] leading-[1.6]">
                <span className="font-extrabold text-[#1F6B3B]">{title}</span> — {description}
              </p>
            ))}
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] leading-[1.6]">
            {CORE_FEATURES.map((item) => <li key={item}>{item}</li>)}
          </ul>
          {proposal.niveis.length > 0 && (
            <p className="mt-3 text-[10px] text-slate-600">
              <span className="font-bold">Níveis de ensino previstos:</span> {proposal.niveis.join(" · ")}.
            </p>
          )}
        </Section>

        <Section index={3} title="Condições comerciais">
          <div className="proposal-keep rounded-lg border border-emerald-100 bg-[#F5F9F6] p-4">
            <p className="text-[21px] font-extrabold text-[#1F6B3B]">{formatKz(proposal.mensalidade)} <span className="text-[12px] font-semibold">/ mês</span></p>
            <p className="text-[11px] font-bold">Plano {plan?.label || "Por confirmar"}</p>
            <p className="mt-2 text-[11px] leading-relaxed">
              Taxa de ativação: <strong>{proposal.taxa === 0 ? "Isenta (Kz 0)" : formatKz(proposal.taxa)}</strong>
              {" · "}Periodicidade proposta: mensal{" · "}Vencimento no dia 5 de cada mês.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed">
              Pagamento inicial: <strong>{formatKz(valorInicial)}</strong> (taxa de ativação e primeira mensalidade antecipada).
            </p>
          </div>
          <p className="mt-3 text-[11px] leading-[1.7]">
            A subscrição inclui acesso contínuo à KLASSE, infraestrutura do plano, manutenção,
            atualizações e suporte durante a vigência, conforme a Política de Suporte e Níveis de Serviço (SLA).
          </p>
          <p className="mt-2 text-[11px] leading-[1.7]">
            No plano mensal, a primeira mensalidade é paga antecipadamente e creditada para o primeiro ciclo
            completo de cobrança após a entrada em funcionamento. Se a entrada em funcionamento ocorrer fora
            do dia 5, o período até ao próximo dia 5 fica incluído sem cobrança adicional. As mensalidades
            seguintes vencem no dia 5 de cada mês.
          </p>
          {proposal.trial !== null && proposal.trial > 0 && (
            <p className="mt-2 text-[11px] leading-[1.7]">
              <strong>Período de demonstração negociado:</strong> {proposal.trial} dias. As datas e a relação
              entre o período de demonstração e a cobrança inicial serão formalizadas no Termo de Adesão.
            </p>
          )}
        </Section>

        <Section index={4} title="Pagamento">
          <div className="proposal-keep grid gap-x-4 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
            <Field title="Banco" value="Banco Yetu S.A" />
            <Field title="Titular" value="MOXI SOLUCOES COMERCIO G P S SU LDA" />
            <Field title="Número de conta" value="10117234810001" />
            <Field title="IBAN" value="AO06 0066 0000 1017 2348 10197" />
            <Field title="Kwik" value="006600001017234810197" />
          </div>
          <p className="mt-3 text-[11px] leading-[1.6]">A confirmação do pagamento poderá ser enviada para <strong>contato@klasse.ao</strong> ou WhatsApp <strong>+244 933 349 106</strong>.</p>
        </Section>

        <Section index={5} title="Implantação inicial">
          <p className="proposal-keep mb-3 rounded-lg bg-slate-50 p-3 text-center text-[10px] font-bold tracking-wide text-[#1F6B3B]">
            Aceite → Ativação → Configuração → Formação → Entrada em funcionamento
          </p>
          <p className="text-[11px] leading-[1.7]">
            A taxa de ativação inclui a configuração inicial da escola, preparação do ambiente, criação de
            acessos administrativos, apoio à importação inicial dos dados acordados, formação da equipa e
            acompanhamento assistido durante os primeiros 7–14 dias após a entrada em funcionamento.
          </p>
        </Section>

        <Section index={6} title="Premissas">
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-[1.7]">
            <li>A escola deverá fornecer dados corretos e em formato utilizável para migração.</li>
            <li>Customizações, integrações ou migração de histórico fora do escopo poderão ser avaliadas e orçadas separadamente.</li>
            <li>Após o aceite contratual e a confirmação do pagamento inicial, a KLASSE definirá e comunicará a data de ativação.</li>
          </ul>
        </Section>

        <Section index={7} title="Aceite comercial">
          <p className="mb-4 text-[11px] leading-[1.7]">
            Ao aceitar esta proposta, a escola confirma o interesse na contratação nas condições acima,
            sujeita à assinatura do Termo de Adesão e às políticas aplicáveis da KLASSE.
          </p>
          <div className="proposal-keep rounded-lg border border-slate-200 p-4">
            <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-[#1F6B3B]">Ponto focal para implantação</h3>
            <p className="mt-2 text-[11px] leading-6">Nome: ____________________________________</p>
            <p className="text-[11px] leading-6">Cargo: ____________________________________</p>
            <p className="text-[11px] leading-6">WhatsApp: _________________________________</p>
            <p className="text-[11px] leading-6">E-mail: ____________________________________</p>
            <p className="mt-2 text-[10px] text-slate-500">Contacto principal da escola para partilha e validação de informações durante a implantação.</p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-7 sm:grid-cols-2 print:grid-cols-2">
            <Signature title="Cliente" role="Cargo" />
            <Signature title="KLASSE / MOXI SOLUÇÕES" role="Representante" />
          </div>
        </Section>

        <footer className="proposal-keep mt-7 border-t-2 border-[#E3B23C] pt-4">
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[#1F6B3B]">Identificação da prestadora</p>
          <p className="text-[10px] leading-[1.6]">
            KLASSE é um produto da MOXI SOLUÇÕES - COMERCIO GERAL E PRESTAÇÃO DE SERVIÇOS, (SU), LDA.
            {" "}NIF: 5002637618.
          </p>
          <p className="text-[10px] leading-[1.6]">
            Sede: Bairro Azul, Rua dos Bombeiros, N.º S/N, Município de Menongue,
            Província do Cubango, Angola.
          </p>
          <p className="text-[10px] leading-[1.6]">contato@klasse.ao · +244 933 349 106</p>
        </footer>
      </main>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 13mm; }
          html, body { background: white !important; }
          .commercial-proposal { box-shadow: none !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .commercial-proposal .proposal-keep { break-inside: avoid; page-break-inside: avoid; }
          .commercial-proposal .proposal-section > h2 { break-after: avoid; page-break-after: avoid; }
        }
      `}</style>
    </div>
  );
}

export default function ProposalPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">A carregar proposta comercial...</div>}>
      <ProposalPreviewContent />
    </Suspense>
  );
}
