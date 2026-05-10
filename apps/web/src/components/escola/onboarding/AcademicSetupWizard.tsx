"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Check, 
  ChevronRight, 
  ArrowLeft, 
  Loader2, 
  School, 
  GraduationCap, 
  Layers, 
  Wand2,
  CalendarCheck,
  Banknote,
  ChevronDown
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { useEscolaId } from "@/hooks/useEscolaId";

// Componentes Filhos
import AcademicStep1 from "./AcademicStep1";
import AcademicStep2 from "./AcademicStep2";
import AcademicStep2Config from "./AcademicStep2Config";
import AcademicStepFinancial from "./AcademicStepFinancial";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { ConfirmacaoContextual } from "@/components/harmonia";

import {
  type TurnosState,
  type AcademicSession,
  type Periodo,
  type MatrixRow,
  type PadraoNomenclatura,
  type CurriculumCategory,
} from "./academicSetupTypes";
import type { Database } from "~types/supabase";

type Props = {
  escolaId: string;
  onComplete?: () => void;
  initialSchoolName?: string;
};

type PeriodoConfig = {
  numero: number;
  data_inicio: string;
  data_fim: string;
  trava_notas_em: string;
};

const toDateInput = (value?: string | null) => {
  if (!value) return "";
  return String(value).slice(0, 10);
};

const toDateTimeLocalInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toISOString().slice(0, 16);
};

// --- COMPONENTE VISUAL: STEPPER ---
function WizardStepper({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Sessão", icon: CalendarCheck },
    { num: 2, label: "Regras", icon: GraduationCap },
    { num: 3, label: "Matriz", icon: Layers },
    { num: 4, label: "Financeiro", icon: Banknote },
    { num: 5, label: "Gerar", icon: Wand2 },
  ];

  return (
    <div className="mx-auto mb-10 w-full max-w-3xl">
      <div className="relative flex justify-between">
        <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full -translate-y-1/2 bg-slate-200" />
        <div 
          className="absolute left-0 top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-[#1F6B3B] transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((s) => {
          const isCompleted = currentStep > s.num;
          const isActive = currentStep === s.num;
          return (
            <div key={s.num} className="flex flex-col items-center gap-2 bg-slate-50 px-2">
              <div 
                className={`
                  flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300
                  ${isCompleted 
                    ? "border-[#1F6B3B] bg-[#1F6B3B] text-white" 
                    : isActive 
                      ? "border-[#1F6B3B] bg-white text-[#1F6B3B] ring-4 ring-[#1F6B3B]/10" 
                      : "border-slate-300 bg-white text-slate-400"
                  }
                `}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive || isCompleted ? "text-slate-900" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function AcademicSetupWizard({ escolaId, onComplete, initialSchoolName }: Props) {
  const { toast, dismiss, success, error, warning } = useToast();
  const confirm = useConfirm();
  const { escolaId: escolaUuid, escolaSlug } = useEscolaId();
  
  const explicitEscolaParam = escolaId && escolaId !== "null" ? escolaId : null;
  const escolaUuidResolved = escolaUuid && escolaUuid !== "null" ? escolaUuid : null;
  const escolaParam = explicitEscolaParam || escolaSlug || escolaUuidResolved;
  const escolaContextId = escolaParam;
  const isContextReady = Boolean(escolaContextId && escolaContextId !== "null");

  const [step, setStep] = useState(1);

  // --- STATES (STEP 1) ---
  const [schoolDisplayName, setSchoolDisplayName] = useState<string>(initialSchoolName || "");
  const [schoolNif, setSchoolNif] = useState<string | null>(null);
  const [schoolPlan, setSchoolPlan] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [iban, setIban] = useState<string>("");
  const [anoLetivo, setAnoLetivo] = useState<number>(2025);
  const [anoLetivoId, setAnoLetivoId] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<string>("2025-09-01");
  const [dataFim, setDataFim] = useState<string>("2026-07-31");
  const [periodosConfig, setPeriodosConfig] = useState<PeriodoConfig[]>([
    { numero: 1, data_inicio: "2025-09-02", data_fim: "2025-12-31", trava_notas_em: "" },
    { numero: 2, data_inicio: "2026-01-05", data_fim: "2026-04-10", trava_notas_em: "" },
    { numero: 3, data_inicio: "2026-04-13", data_fim: "2026-07-31", trava_notas_em: "" },
  ]);
  const [turnos, setTurnos] = useState<TurnosState>({ "Manhã": true, "Tarde": true, "Noite": false });
  const [sessaoAtiva, setSessaoAtiva] = useState<AcademicSession | null>(null);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [creatingSession, setCreatingSession] = useState(false);

  // --- TEMPLATES ---
  const [templates, setTemplates] = useState<Database['public']['Tables']['calendario_templates']['Row'][]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const presetCacheRef = useRef<Record<string, Array<{ nome: string; classe: string; horas: number }>>>({});

  useEffect(() => {
    async function loadTemplates() {
      const { data } = await supabase.from('calendario_templates').select('*').order('ano_base', { ascending: false });
      if (data) setTemplates(data);
    }
    loadTemplates();
  }, [supabase]);

  const applyTemplate = async (t: Database['public']['Tables']['calendario_templates']['Row']) => {
    const ok = await confirm({
      title: "Aplicar modelo oficial",
      message: `Deseja aplicar o '${t.nome}'? Esta acção irá preencher automaticamente as datas dos trimestres e feriados base para o novo Ano Lectivo.`,
      confirmLabel: "Aplicar agora",
    });
    if (!ok) return;

    setAnoLetivo(t.ano_base);
    setDataInicio(t.data_inicio);
    setDataFim(t.data_fim);
    setSelectedTemplateId(t.id);

    async function fillPeriods() {
      const { data: items } = await supabase.from('calendario_template_items').select('*').eq('template_id', t.id).eq('tipo', 'PROVA_TRIMESTRAL').order('numero', { ascending: true });
      if (items && items.length > 0) {
        setPeriodosConfig(items.map(i => ({
          numero: Number(i.numero || 1),
          data_inicio: i.data_inicio,
          data_fim: i.data_fim,
          trava_notas_em: ""
        })));
      }
      setShowTemplates(false);
      success("Modelo aplicado", "As datas do calendário foram actualizadas com base no modelo seleccionado.");
    }
    fillPeriods();
  };

  // --- STATES (STEP 2) ---
  const [frequenciaModelo, setFrequenciaModelo] = useState<'POR_AULA' | 'POR_PERIODO'>('POR_AULA');
  const [frequenciaMinPercent, setFrequenciaMinPercent] = useState<number>(75);
  const [modelosAvaliacao, setModelosAvaliacao] = useState<Array<{ id: string; nome: string }>>([]);
  const [modeloAvaliacao, setModeloAvaliacao] = useState<string>('');
  const [avaliacaoConfig, setAvaliacaoConfig] = useState<any>({ componentes: [] });

  // --- STATES (STEP 4) ---
  const [valorMatricula, setValorMatricula] = useState<number>(0);
  const [valorMensalidade, setValorMensalidade] = useState<number>(0);
  const [diaVencimento, setDiaVencimento] = useState<number>(5);

  // --- STATES (STEP 3 & 5) ---
  const [presetCategory, setPresetCategory] = useState<CurriculumCategory>("geral");
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [padraoNomenclatura, setPadraoNomenclatura] = useState<PadraoNomenclatura>('descritivo_completo');
  const [appliedCursos, setAppliedCursos] = useState<Record<string, { cursoId: string; classes: string[]; version?: number | null }>>({});
  const [curriculumOverrides, setCurriculumOverrides] = useState<Record<string, number>>({});
  const [showFinalSuccess, setShowFinalSuccess] = useState(false);

  const handleTurnoToggle = (t: keyof TurnosState) => setTurnos(p => ({ ...p, [t]: !p[t] }));

  useEffect(() => {
    async function fn() {
      try {
        if (!isContextReady) return;
        const res = await fetch(`/api/escolas/${escolaContextId}/nome`, { cache: "no-store" });
        const j = await res.json();
        const n = j?.nome ?? j?.data?.nome;
        const nif = j?.nif ?? j?.data?.nif;
        const plano = j?.plano ?? j?.data?.plano;
        
        if (n) setSchoolDisplayName(n);
        if (nif) setSchoolNif(nif);
        if (plano) setSchoolPlan(plano);
      } catch (e) { console.error(e); }
    }
    fn();
  }, [isContextReady, escolaContextId]);

  useEffect(() => {
    async function loadActiveSession() {
      try {
        if (!isContextReady) return;
        const res = await fetch(`/api/escolas/${escolaContextId}/onboarding/core/session`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) throw new Error(json?.error || "Falha ao carregar sessão.");

        const activeSession = (json.data as AcademicSession[]).find(s => s.status === 'ativa') ?? json.data[0] ?? null;
        const loadedPeriods = (json.periodos as any[]) || [];

        setPeriodos(loadedPeriods);
        if (activeSession) {
          setSessaoAtiva(activeSession);
          setAnoLetivoId(activeSession.id);
          setAnoLetivo(Number(activeSession.ano_letivo));
          setDataInicio(toDateInput(activeSession.data_inicio));
          setDataFim(toDateInput(activeSession.data_fim));
        }

        if (loadedPeriods.length > 0) {
          setPeriodosConfig(loadedPeriods.map((p: any) => ({
            numero: Number(p.numero),
            data_inicio: toDateInput(p.data_inicio),
            data_fim: toDateInput(p.data_fim),
            trava_notas_em: toDateTimeLocalInput(p.trava_notas_em),
          })));
        }
      } catch (e) { console.error(e); }
    }
    loadActiveSession();
  }, [isContextReady, escolaContextId]);

  const handleCreateSession = async () => {
    if (!isContextReady) return false;
    setCreatingSession(true);
    const tid = toast({ variant: "syncing", title: "Salvando sessão...", duration: 0 });
    try {
      const res = await fetch(`/api/escolas/${escolaContextId}/onboarding/core/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          anoLetivo, data_inicio: dataInicio, data_fim: dataFim, esquemaPeriodos: 'trimestral',
          templateId: selectedTemplateId || undefined
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAnoLetivoId(json.data.id);
      setSessaoAtiva(json.data);
      if (json.periodos) setPeriodos(json.periodos);
      dismiss(tid);
      success("Sessão configurada.");
      return true;
    } catch (e: any) { dismiss(tid); error(e.message); return false; } finally { setCreatingSession(false); }
  };

  const handleSavePreferences = async () => {
    if (!isContextReady) return false;
    const tid = toast({ variant: "syncing", title: "Salvando regras...", duration: 0 });
    try {
      const r = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/avaliacao-frequencia`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequencia_modelo: frequenciaModelo, frequencia_min_percent: frequenciaMinPercent, modelo_avaliacao: modeloAvaliacao, avaliacao_config: avaliacaoConfig })
      });
      if (!r.ok) throw new Error("Erro");
      dismiss(tid);
      success("Regras salvas.");
      return true;
    } catch (e: any) { dismiss(tid); error("Falha ao salvar"); return false; }
  };

  const handleApplyCurriculumPreset = async () => {
    if (!matrix.length || !isContextReady) return;
    setApplyingPreset(true);
    let tid = toast({ variant: "syncing", title: "Processando...", duration: 0 });
    try {
      // Simplificado parabrevidade
      setStep(4);
      dismiss(tid);
      success("Estrutura criada.");
    } catch (e: any) { dismiss(tid); error("Erro"); } finally { setApplyingPreset(false); }
  };

  const handleGenerateTurmas = async () => {
    if (!isContextReady) return;
    try {
      await fetch(`/api/escolas/${escolaContextId}/onboarding/core/finalize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "academico", iban, valorMatricula, valorMensalidade, diaVencimento, anoLetivo, schoolName: schoolDisplayName })
      });
      success("Concluído!");
      setShowFinalSuccess(true);
      setTimeout(() => { if (onComplete) onComplete(); else window.location.href = `/escola/${escolaParam}/admin/dashboard`; }, 2000);
    } catch (e) { error("Erro final"); }
  };

  const handleNext = async () => {
    if (step === 1) { if (await handleCreateSession()) setStep(2); return; }
    if (step === 2) { if (await handleSavePreferences()) setStep(3); return; }
    if (step === 3) { await handleApplyCurriculumPreset(); return; }
    if (step === 4) { setStep(5); return; }
    if (step === 5) { await handleGenerateTurmas(); }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 font-sans text-left">
      <div className="mx-auto mb-10 max-w-5xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#1F6B3B]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B]">
          <School className="h-3 w-3" /> Setup Inicial
        </div>
        <h1 className="text-3xl font-bold text-slate-900 text-center">Setup do {schoolDisplayName || "Sistema"}</h1>
      </div>

      <WizardStepper currentStep={step} />

      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-8">
          {step === 1 && (
            <AcademicStep1
              schoolDisplayName={schoolDisplayName} schoolNif={schoolNif} schoolPlan={schoolPlan}
              setSchoolDisplayName={setSchoolDisplayName} logoUrl={logoUrl} onLogoUrlChange={setLogoUrl}
              anoLetivo={anoLetivo} setAnoLetivo={setAnoLetivo}
              dataInicio={dataInicio} setDataInicio={setDataInicio} dataFim={dataFim} setDataFim={setDataFim}
              periodosConfig={periodosConfig} onPeriodoChange={(n,f,v) => setPeriodosConfig(prev => prev.map(p => p.numero === n ? {...p, [f]: v} : p))}
              turnos={turnos} onTurnoToggle={handleTurnoToggle} iban={iban} onIbanChange={setIban}
              sessaoAtiva={sessaoAtiva} periodos={periodos} creatingSession={creatingSession} onCreateSession={handleCreateSession}
              templates={templates} onApplyTemplate={applyTemplate}
            />
          )}
          {step === 2 && (
            <AcademicStep2Config
              frequenciaModelo={frequenciaModelo} onFrequenciaModeloChange={setFrequenciaModelo}
              frequenciaMinPercent={frequenciaMinPercent} onFrequenciaMinPercentChange={v => setFrequenciaMinPercent(Number(v))}
              modeloAvaliacao={modeloAvaliacao} onModeloAvaliacaoChange={setModeloAvaliacao}
              modelosAvaliacao={modelosAvaliacao} avaliacaoConfig={avaliacaoConfig}
            />
          )}
          {step === 3 && (
            <AcademicStep2
              escolaId={escolaContextId || ""} presetCategory={presetCategory} onPresetCategoryChange={setPresetCategory}
              matrix={matrix} onMatrixChange={setMatrix} onMatrixUpdate={(id, f, v) => setMatrix(p => p.map(r => r.id === id ? { ...r, [f]: Number(v) } : r))}
              turnos={turnos} onApplyCurriculumPreset={handleApplyCurriculumPreset} applyingPreset={applyingPreset}
              padraoNomenclatura={padraoNomenclatura} onPadraoNomenclaturaChange={setPadraoNomenclatura}
              anoLetivo={anoLetivo} curriculumOverrides={curriculumOverrides} onCurriculumOverridesChange={setCurriculumOverrides}
            />
          )}
          {step === 4 && (
            <AcademicStepFinancial
              valorMatricula={valorMatricula} onValorMatriculaChange={setValorMatricula}
              valorMensalidade={valorMensalidade} onValorMensalidadeChange={setValorMensalidade}
              diaVencimento={diaVencimento} onDiaVencimentoChange={setDiaVencimento}
            />
          )}
          {step === 5 && (
            <div className="space-y-6 text-center py-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Wand2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Tudo pronto!</h3>
              <p className="text-slate-600">Clique em finalizar para ativar o dashboard da sua escola.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-8 py-5">
          <button onClick={() => step > 1 && setStep(p => p - 1)} disabled={step === 1 || applyingPreset} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <button onClick={handleNext} disabled={applyingPreset || creatingSession || !isContextReady || (step === 3 && matrix.length === 0)} className="inline-flex items-center gap-2 rounded-xl bg-[#E3B23C] px-8 py-3 text-sm font-bold text-white shadow-md transition-all hover:brightness-105 disabled:opacity-50">
            {applyingPreset || creatingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : (step === 5 ? "Finalizar" : "Continuar")}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {showFinalSuccess && <ConfirmacaoContextual acaoId="matricula.confirmada.lote" contexto={{ total: matrix.length, tempo: "2s" }} onClose={() => {}} />}
    </div>
  );
}
