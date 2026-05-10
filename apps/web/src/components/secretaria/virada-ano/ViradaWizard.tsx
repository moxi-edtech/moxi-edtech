"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  CheckCircle2, 
  ChevronRight, 
  AlertCircle, 
  RotateCcw, 
  ShieldCheck, 
  Zap, 
  FileText,
  Info,
  Loader2,
  RefreshCcw,
  Users,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CutoverHealthReport } from "@/lib/operacoes-academicas/cutover-health";
import { useToast } from "@/components/feedback/FeedbackSystem";

// Sub-components
import { FreezeStep } from "./FreezeStep";
import { ConfigStep } from "./ConfigStep";
import { PromotionStep } from "./PromotionStep";
import { ExecuteStep } from "./ExecuteStep";

type Step = {
  id: number;
  title: string;
  description: string;
};

type StepIssue = {
  id: string;
  label: string;
  severity: "critical" | "warning";
  action?: {
    label: string;
    handler: () => Promise<void>;
    loading: boolean;
  };
};

type WizardPayload = {
  target_session_id?: string;
  [key: string]: unknown;
};

type WizardResponse = {
  ok?: boolean;
  wizard?: {
    id: string;
    current_step: number;
    payload?: WizardPayload;
  };
};

type HealthResponse = {
  ok?: boolean;
  report?: CutoverHealthReport;
};

type FixSessionsResponse = {
  ok?: boolean;
  error?: string;
  result?: {
    fixed_turmas?: number;
    fixed_matriculas?: number;
  };
};

const STEPS: Step[] = [
  { id: 0, title: "Check-up", description: "Validação de integridade dos dados atuais." },
  { id: 1, title: "Congelamento", description: "Geração de pautas e snapshots históricos." },
  { id: 2, title: "Configuração", description: "Definição de datas do ano letivo seguinte." },
  { id: 3, title: "Simulação", description: "Prévia de rematrícula e bloqueios." },
  { id: 4, title: "Virada Atômica", description: "Execução final e encerramento do ciclo." },
];

export function ViradaWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setLoadingSaving] = useState(false);
  const [wizardId, setWizardId] = useState<string | null>(null);
  
  // Cross-step Data (Payload)
  const [payload, setPayload] = useState<WizardPayload>({});
  
  // Health Data
  const [health, setHealth] = useState<CutoverHealthReport | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [fixingSessions, setFixingSessions] = useState(false);

  const { success, error: toastError } = useToast();

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch("/api/secretaria/operacoes-academicas/virada/health", { cache: 'no-store' });
      const json = (await res.json()) as HealthResponse;
      if (json.ok && json.report) setHealth(json.report);
    } finally {
      setLoadingHealth(false);
    }
  };

  // 1. Carregar Estado Persistente e Saúde
  useEffect(() => {
    const init = async () => {
      const res = await fetch("/api/secretaria/operacoes-academicas/virada/wizard");
      const json = (await res.json()) as WizardResponse;
      if (json.ok && json.wizard) {
        setWizardId(json.wizard.id);
        setCurrentStep(json.wizard.current_step);
        setPayload(json.wizard.payload || {});
      }
      await fetchHealth();
      setLoading(false);
    };
    init();
  }, []);

  // 2. Salvar Progresso
  const saveProgress = async (step: number, extraPayload: Partial<WizardPayload> = {}) => {
    setLoadingSaving(true);
    const newPayload = { ...payload, ...extraPayload };
    try {
      const res = await fetch("/api/secretaria/operacoes-academicas/virada/wizard", {
        method: "POST",
        body: JSON.stringify({ current_step: step, payload: newPayload }),
      });
      const json = (await res.json()) as WizardResponse;
      if (json.ok) {
        if (!json.wizard) return;
        setCurrentStep(step);
        setWizardId(json.wizard.id);
        setPayload(json.wizard.payload ?? {});
        if (step === 0) await fetchHealth();
      }
    } finally {
      setLoadingSaving(false);
    }
  };

  // 3. Ações de Correção (Low Friction)
  const handleFixSessions = async () => {
    setFixingSessions(true);
    try {
      const res = await fetch("/api/secretaria/operacoes-academicas/virada/fix-sessions", { method: "POST" });
      const json = (await res.json()) as FixSessionsResponse;
      if (json.ok) {
        success(`Sucesso: ${json.result?.fixed_turmas ?? 0} turmas e ${json.result?.fixed_matriculas ?? 0} matrículas vinculadas.`);
        await fetchHealth();
      } else {
        toastError(json.error || "Falha ao corrigir sessões.");
      }
    } finally {
      setFixingSessions(false);
    }
  };

  const step0Issues = useMemo(() => {
    if (!health) return [] as StepIssue[];
    const list: StepIssue[] = [];

    health.blockers.forEach((blocker) => {
        // 1. Session ID Null
        if (blocker.includes("sem session_id")) {
            list.push({
                id: 'session_id_null',
                label: blocker,
                severity: 'critical',
                action: { label: 'Vincular Automaticamente', handler: handleFixSessions, loading: fixingSessions }
            });
        }
        // 2. No active year
        else if (blocker.includes("Nenhum ano letivo ativo")) {
            list.push({
                id: 'no_active_year',
                label: blocker,
                severity: 'critical',
                action: { 
                    label: 'Configurar Ano Letivo', 
                    handler: async () => { window.location.href = `/escola/${health.escola_id}/admin/configuracoes/estrutura`; }, 
                    loading: false 
                }
            });
        }
        // 3. Past Data
        else if (blocker.includes("anos PASSADOS")) {
            list.push({
                id: 'past_data',
                label: blocker,
                severity: 'critical',
                action: { 
                    label: 'Abrir Fechamento', 
                    handler: async () => { window.location.href = `/escola/${health.escola_id}/admin/operacoes-academicas/fechamento-academico`; }, 
                    loading: false 
                }
            });
        }
        // 4. Null year data
        else if (blocker.includes("ano_letivo NULO")) {
            list.push({
                id: 'null_year',
                label: blocker,
                severity: 'critical',
                action: { 
                    label: 'Limpar Dados Órfãos', 
                    handler: async () => { success("Funcionalidade de limpeza manual em desenvolvimento."); }, 
                    loading: false 
                }
            });
        }
        // 5. Technical Errors
        else if (blocker.includes("Falha técnica")) {
            list.push({
                id: 'tech_error',
                label: blocker,
                severity: 'critical',
                action: { label: 'Tentar Novamente', handler: fetchHealth, loading: loadingHealth }
            });
        }
        // Default (Unmapped)
        else {
            list.push({
                id: Math.random().toString(),
                label: blocker,
                severity: 'critical'
            });
        }
    });

    return list;
  }, [health, fixingSessions, loadingHealth]);

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  const canProceed = currentStep === 0 ? (health?.status !== "BLOCKED" && step0Issues.filter(i => i.severity === 'critical').length === 0) : true;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Assistente de Virada de Ano Letivo</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Siga o percurso guiado para uma transição segura e auditável.</p>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
        </div>
      </div>

      {/* Stepper Visual */}
      <div className="mb-12 flex items-center justify-between px-4 overflow-x-auto pb-6 scrollbar-hide">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex flex-1 items-center last:flex-none min-w-[140px]">
            <div className="flex flex-col items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-all duration-300 ${
                currentStep > index ? "border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm" :
                currentStep === index ? "border-klasse-gold bg-klasse-gold/10 text-klasse-gold shadow-md ring-4 ring-klasse-gold/10" :
                "border-slate-100 text-slate-300"
              }`}>
                {currentStep > index ? <CheckCircle2 className="h-6 w-6" /> : <span className="font-black text-sm">{index + 1}</span>}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest text-center ${currentStep === index ? "text-slate-900" : "text-slate-400"}`}>
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`mx-6 h-[2px] flex-1 rounded-full ${currentStep > index ? "bg-emerald-500" : "bg-slate-50"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Conteúdo Dinâmico por Passo */}
      <div className="mb-10 min-h-[450px] rounded-3xl border border-slate-100 bg-slate-50/40 p-10 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/40 blur-3xl" />
        
        <div className="w-full max-w-3xl relative z-10">
          <div className="text-center mb-10">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-100/50">
                {currentStep === 0 && <Zap className="h-7 w-7 text-klasse-gold fill-current" />}
                {currentStep === 1 && <FileText className="h-7 w-7 text-blue-500" />}
                {currentStep === 2 && <RotateCcw className="h-7 w-7 text-purple-500" />}
                {currentStep === 3 && <Users className="h-7 w-7 text-orange-500" />}
                {currentStep === 4 && <ShieldCheck className="h-7 w-7 text-emerald-600" />}
            </div>
            <h2 className="mb-2 text-2xl font-black text-slate-900 tracking-tight">{STEPS[currentStep].title}</h2>
            <p className="text-sm font-medium text-slate-500">{STEPS[currentStep].description}</p>
          </div>
          
          {/* Roteamento de Componentes por Passo */}
          {currentStep === 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Diagnóstico de Requisitos</h3>
                 <button onClick={fetchHealth} disabled={loadingHealth} className="p-2 text-slate-400 hover:text-slate-900 transition-all hover:bg-white rounded-xl shadow-sm">
                    <RefreshCcw className={`h-4 w-4 ${loadingHealth ? 'animate-spin' : ''}`} />
                 </button>
               </div>

               {loadingHealth ? (
                 <div className="space-y-3">
                    {[1,2].map(i => <div key={i} className="h-16 bg-white/50 rounded-2xl border border-slate-100 animate-pulse" />)}
                 </div>
               ) : (
                 <div className="space-y-4">
                    {step0Issues.length === 0 && health?.status === "OK" ? (
                        <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
                            <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                            </div>
                            <p className="text-lg font-black text-emerald-900">Tudo pronto para prosseguir!</p>
                            <p className="text-sm text-emerald-600 mt-2 font-medium opacity-80">Nenhuma inconsistência estrutural foi encontrada na sessão atual.</p>
                        </div>
                    ) : (
                        step0Issues.map((issue) => (
                            <div key={issue.id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-klasse-gold/50 hover:shadow-md transition-all duration-300">
                                <div className="flex flex-wrap items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-amber-50 text-amber-500 group-hover:scale-110 transition-transform">
                                            <AlertCircle className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 leading-snug">{issue.label}</p>
                                            <p className="text-[10px] text-amber-600 uppercase font-black tracking-widest mt-1">Bloqueador de Virada</p>
                                        </div>
                                    </div>
                                    {issue.action && (
                                        <Button 
                                            size="sm" 
                                            tone="gold" 
                                            variant="ghost" 
                                            className="h-10 gap-2 font-black border-2 border-klasse-gold/20 hover:border-klasse-gold"
                                            loading={issue.action.loading}
                                            onClick={issue.action.handler}
                                        >
                                            <Wand2 className="h-4 w-4" />
                                            {issue.action.label}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    
                    {health?.warnings.map((warn, i) => (
                        <div key={`warn-${i}`} className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-blue-50/50 border border-blue-100 text-blue-700 shadow-sm">
                            <Info className="h-4 w-4" />
                            <span className="text-xs font-bold tracking-tight">{warn}</span>
                        </div>
                    ))}
                 </div>
               )}
            </div>
          )}

          {currentStep === 1 && <FreezeStep onComplete={() => {}} />}
          {currentStep === 2 && <ConfigStep onComplete={() => {}} saveProgress={saveProgress} />}
          {currentStep === 3 && <PromotionStep onComplete={() => {}} />}
          {currentStep === 4 && (
            <ExecuteStep 
                onComplete={() => {}} 
                fromSession={health?.active_year?.id || ''} 
                toSession={payload?.target_session_id || ''} 
            />
          )}

        </div>
      </div>

      {/* Ações de Rodapé */}
      <div className="flex justify-between border-t border-slate-100 pt-8">
        <Button 
          tone="gray" 
          variant="ghost" 
          className="h-12 px-8 font-bold rounded-2xl"
          disabled={currentStep === 0 || saving}
          onClick={() => saveProgress(currentStep - 1)}
        >
          Voltar
        </Button>
        
        <div className="flex items-center gap-6">
            {saving && <span className="text-[10px] font-black uppercase text-slate-300 animate-pulse tracking-widest">Salvando Progresso...</span>}
            <Button 
              tone="gold" 
              className="h-12 px-10 gap-2 font-black rounded-2xl shadow-lg shadow-klasse-gold/20"
              loading={saving}
              disabled={currentStep === STEPS.length - 1 || !canProceed}
              onClick={() => saveProgress(currentStep + 1)}
            >
              {canProceed ? "Próximo passo" : "Resolver bloqueadores"} <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
        </div>
      </div>

      {/* Footer Audit */}
      <div className="mt-8 flex items-center justify-center gap-2.5 py-3 px-6 rounded-2xl bg-slate-50/50 border border-slate-100 w-fit mx-auto">
        <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ambiente de Produção • Auditado via Ledger SSOT</span>
      </div>
    </div>
  );
}
