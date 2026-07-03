"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, ArrowLeft, ShieldCheck, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

function ProposalPreviewContent() {
  const searchParams = useSearchParams();

  const escola = searchParams?.get("escola") || "Escola Exemplo";
  const contacto = searchParams?.get("contacto") || "Não informado";
  const plano = searchParams?.get("plano") || "profissional";
  const alunos = Number(searchParams?.get("alunos") || "0");
  const trial = Number(searchParams?.get("trial") || "15");
  const taxa = Number(searchParams?.get("taxa") || "0");
  const mensalidade = Number(searchParams?.get("mensalidade") || "0");
  const preset = searchParams?.get("preset") || "";

  const niveisRaw = searchParams?.get("niveis") || "";
  const secNome = searchParams?.get("sec_nome") || "";
  const secEmail = searchParams?.get("sec_email") || "";
  const secTel = searchParams?.get("sec_tel") || "";
  const finNome = searchParams?.get("fin_nome") || "";
  const finEmail = searchParams?.get("fin_email") || "";
  const finTel = searchParams?.get("fin_tel") || "";
  const pedNome = searchParams?.get("ped_nome") || "";
  const pedEmail = searchParams?.get("ped_email") || "";
  const pedTel = searchParams?.get("ped_tel") || "";

  const planName = plano === "essencial" ? "Klasse Essencial" : plano === "premium" ? "Klasse Premium" : "Klasse Profissional";

  const presetNameMap: Record<string, string> = {
    pre_escolar: "Educação Pré-Escolar",
    primario_generico: "Ensino Primário (1ª-6ª Classe)",
    esg_ciclo1: "Iº Ciclo Secundário (7ª-9ª Classe)",
    esg_puniv_cfb: "PUNIV - Ciências Físicas e Biol.",
    esg_puniv_cej: "PUNIV - Ciências Econ. e Jurídicas",
    esg_puniv_cch: "PUNIV - Ciências Sociais e Humanas",
    tec_informatica: "Técnico de Informática",
    tec_contabilidade: "Técnico de Contabilidade",
    tec_informatica_gestao: "Técnico de Informática de Gestão",
    tec_saude_enfermagem: "Técnico de Enfermagem",
    tec_saude_analises: "Técnico de Análises Clínicas",
  };

  const niveisMap: Record<string, string> = {
    primario: "Ensino Primário",
    ciclo1: "Iº Ciclo Secundário",
    puniv: "PUNIV / Geral",
    tecnico: "Ensino Técnico",
  };
  const niveisList = niveisRaw ? niveisRaw.split(",").map((n) => niveisMap[n] || n) : [];

  const PLAN_FEATURES = {
    essencial: [
      "Controle de Matrículas e Turmas",
      "Pautas Académicas de Notas e Frequências",
      "Portal do Professor (Diário de Classe)",
      "Histórico Escolar e Relatórios Básicos",
    ],
    profissional: [
      "Tudo do Essencial",
      "Financeiro Completo e Faturamento Automático",
      "Cobranças por SMS e Notificações de Pagamento",
      "Relatórios de Inadimplência e Projeção Financeira",
      "Conciliação Bancária Automatizada",
    ],
    premium: [
      "Tudo do Profissional",
      "Portal do Aluno e Encarregado de Educação",
      "Emissão de Documentos e Diplomas com QR Code Seguro",
      "Relatórios Avançados de Auditoria e KPI",
      "Suporte Prioritário L2/L3 com SLA Estendido",
    ],
  };

  const currentFeatures = PLAN_FEATURES[plano as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.profissional;

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4 sm:px-6 lg:px-8 print:bg-white print:py-0 print:px-0">
      {/* Top action bar (hidden in print) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-sm print:hidden">
        <Button
          type="button"
          onClick={() => window.close()}
          variant="outline"
          className="h-9 px-4 rounded-xl border-zinc-200 bg-white text-xs font-semibold text-zinc-700 flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> Voltar para o CRM
        </Button>
        <Button
          type="button"
          onClick={() => window.print()}
          className="h-9 px-4 rounded-xl bg-zinc-950 text-xs font-bold text-white hover:bg-zinc-800 flex items-center gap-1.5 border-none"
        >
          <Printer size={14} /> Imprimir Proposta / PDF
        </Button>
      </div>

      {/* Main Document Body */}
      <div className="max-w-4xl mx-auto bg-white p-12 sm:p-16 rounded-3xl border border-zinc-200/80 shadow-md print:shadow-none print:border-none print:p-0">
        
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-zinc-100 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-3 h-3 rounded-full bg-[#1F6B3B]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1F6B3B]">Proposta Comercial Klasse</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 leading-none">
              Proposta de Adesão
            </h1>
            <p className="text-sm text-zinc-500 font-semibold mt-2.5">
              Ref: KL-PROP-{Date.now().toString().substring(7)}
            </p>
          </div>
          <div className="text-right sm:text-right flex flex-col items-end">
            <span className="text-lg font-black tracking-widest text-zinc-950 font-serif">KLASSE</span>
            <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest mt-1">Sistemas de Gestão Escolar</span>
            <span className="text-[10px] font-medium text-zinc-500 mt-2">www.klasse.ao · comercial@klasse.ao</span>
          </div>
        </div>

        {/* Client & Partnership Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-b border-zinc-100">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Destinatário (Escola)</h3>
            <p className="text-base font-bold text-zinc-800">{escola}</p>
            <p className="text-xs font-medium text-zinc-500 mt-1.5">
              Decisor / Ponto de Contacto: <span className="font-semibold text-zinc-800">{contacto}</span>
            </p>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Detalhes da Proposta</h3>
            <p className="text-xs font-medium text-zinc-600">
              Data de Emissão: <span className="font-bold text-zinc-800">{format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: pt })}</span>
            </p>
            <p className="text-xs font-medium text-zinc-600 mt-1">
              Validade da Proposta: <span className="font-bold text-zinc-800">15 dias corridos</span>
            </p>
          </div>
        </div>

        {/* Commercial Terms Summary */}
        <div className="py-8">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-4">Condições Comerciais Acordadas</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/50 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Plano Escolhido</span>
                <p className="text-lg font-bold text-zinc-800 mt-1">{planName}</p>
              </div>
              <div className="mt-3 text-[10px] font-medium text-zinc-500 space-y-0.5">
                <p>Volume: {alunos > 0 ? `${alunos} alunos` : "Não definido"}</p>
                {preset && (
                  <p className="font-bold text-[#1F6B3B]">
                    Modelo: {presetNameMap[preset] || preset}
                  </p>
                )}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/50">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Taxa de Ativação</span>
              <p className="text-lg font-bold text-[#1F6B3B] mt-1 font-mono">
                {taxa > 0 ? `Kz ${taxa.toLocaleString("pt-PT")}` : "Isento"}
              </p>
              <span className="text-[10px] font-medium text-zinc-500 block mt-1">Pago na assinatura do contrato</span>
            </div>
            <div className="p-5 rounded-2xl bg-[#1F6B3B]/5 border border-[#1F6B3B]/10">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#1F6B3B]">Subscrição Mensal</span>
              <p className="text-lg font-bold text-[#1F6B3B] mt-1 font-mono">
                {mensalidade > 0 ? `Kz ${mensalidade.toLocaleString("pt-PT")}` : "Consulte departamento comercial"}
              </p>
              <span className="text-[10px] font-medium text-[#1F6B3B]/80 block mt-1">Faturamento pós-trial</span>
            </div>
          </div>
        </div>

        {/* Plan Features */}
        <div className="py-6 border-t border-zinc-100">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-4">Escopo dos Serviços Incluídos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2.5">
              {currentFeatures.map((feat, index) => (
                <div key={index} className="flex items-start gap-2 text-xs font-semibold text-zinc-700">
                  <ShieldCheck size={14} className="text-[#1F6B3B] shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex gap-3 text-xs leading-relaxed text-amber-900 font-medium">
              <HelpCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Período de Demonstração (Trial)</p>
                <p className="mt-1 text-amber-800/90 font-semibold">
                  A escola usufruirá de **{trial} dias** de licença gratuita sem compromisso, com suporte básico de onboarding e acesso total a todas as funcionalidades do plano contratado para teste operacional.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Níveis de Ensino e Contas de Acesso */}
        {(niveisList.length > 0 || secNome || finNome || pedNome) && (
          <div className="py-6 border-t border-zinc-100">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-4">Estrutura Acadêmica & Credenciais Pré-configuradas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-700">
              {niveisList.length > 0 && (
                <div>
                  <p className="font-bold text-zinc-800 mb-2">Níveis Pedagógicos Contratados:</p>
                  <ul className="list-disc list-inside space-y-1 font-semibold text-zinc-600">
                    {niveisList.map((nivel, idx) => (
                      <li key={idx}>{nivel}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(secNome || finNome || pedNome) && (
                <div className="space-y-3">
                  <p className="font-bold text-zinc-800">Contas de Acesso Administrativas Autodeclaradas:</p>
                  <div className="space-y-2 text-[11px] leading-relaxed">
                    {secNome && (
                      <p>
                        <span className="font-bold text-[#1F6B3B]">Secretaria Geral:</span> {secNome} {secEmail ? `(${secEmail})` : ""} {secTel ? `· Tel: ${secTel}` : ""}
                      </p>
                    )}
                    {finNome && (
                      <p>
                        <span className="font-bold text-[#1F6B3B]">Diretoria Financeira:</span> {finNome} {finEmail ? `(${finEmail})` : ""} {finTel ? `· Tel: ${finTel}` : ""}
                      </p>
                    )}
                    {pedNome && (
                      <p>
                        <span className="font-bold text-[#1F6B3B]">Coordenação Pedagógica / Ops:</span> {pedNome} {pedEmail ? `(${pedEmail})` : ""} {pedTel ? `· Tel: ${pedTel}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLA and Contracts */}
        <div className="py-6 border-t border-zinc-100 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Termos Gerais de Contratação e SLAs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[10px] text-zinc-500 leading-relaxed font-semibold">
            <div className="space-y-2">
              <p className="font-bold text-zinc-700 uppercase">1. Implantação e Ativação</p>
              <p>
                A ativação oficial das pautas e liberação do acesso de alunos está sujeita à conclusão do checklist técnico e assinatura digital do Termo de Aceite pelo Diretor.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-zinc-700 uppercase">2. Níveis de SLA de Suporte L1</p>
              <p>
                Os tempos de atendimento a incidentes pelo parceiro são regulados por contrato:
                - Gravidade Alta: Resposta em até 15 min · Resolução em até 2 horas.
                - Gravidade Média: Resposta em até 1 hora · Resolução em até 8 horas.
                - Gravidade Baixa: Resposta em até 4 horas · Resolução em até 24 horas.
              </p>
            </div>
          </div>
        </div>

        {/* Signatures Area */}
        <div className="mt-16 pt-16 border-t border-zinc-100 grid grid-cols-2 gap-12 text-center text-xs font-bold text-zinc-700">
          <div className="flex flex-col items-center">
            <div className="w-48 border-b border-zinc-300 mb-2 h-10" />
            <p>Pela KLASSE / Parceiro Comercial</p>
            <p className="text-[10px] font-medium text-zinc-400 mt-1">Assinatura e Carimbo</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-48 border-b border-zinc-300 mb-2 h-10" />
            <p>Pelo Cliente / {escola}</p>
            <p className="text-[10px] font-medium text-zinc-400 mt-1">Assinatura e Carimbo</p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function ProposalPreviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 py-10 px-4 text-center text-xs font-semibold text-zinc-500">A carregar proposta...</div>}>
      <ProposalPreviewContent />
    </Suspense>
  );
}
