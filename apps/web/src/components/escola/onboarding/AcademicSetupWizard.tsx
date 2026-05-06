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
  Banknote
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { useEscolaId } from "@/hooks/useEscolaId";

// Componentes Filhos
import AcademicStep1 from "./AcademicStep1";
import AcademicStep2 from "./AcademicStep2";
import AcademicStep2Config from "./AcademicStep2Config";
import AcademicStepFinancial from "./AcademicStepFinancial";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { ConfirmacaoContextual } from "@/components/harmonia";

import {
  type TurnosState,
  type AcademicSession,
  type Periodo,
  type MatrixRow,
  type PadraoNomenclatura,
  type CurriculumCategory,
} from "./academicSetupTypes";

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

// --- HELPERS ---
async function fetchAllPaginated<T>(endpoint: string, limit = 50): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(endpoint, window.location.origin);
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.ok === false) throw new Error(json?.error || "Falha ao carregar dados");
    items.push(...(json?.data ?? json?.items ?? []));
    cursor = json?.next_cursor ?? null;
  } while (cursor);
  return items;
}

type ModeloAvaliacao = {
  id: string;
  nome: string;
  componentes: { componentes?: Array<{ code: string; peso: number; ativo: boolean }> } | Array<{ code: string; peso: number; ativo: boolean }> | null;
  is_default?: boolean;
};

const extractComponentes = (config?: { componentes?: ReadonlyArray<{ code: string; peso: number; ativo: boolean }> } | Array<{ code: string; peso: number; ativo: boolean }> | null) => {
  if (!config) return [];
  if (Array.isArray(config)) return config;
  return config.componentes ?? [];
};

const cloneConfig = (config?: { componentes?: ReadonlyArray<{ code: string; peso: number; ativo: boolean }> } | Array<{ code: string; peso: number; ativo: boolean }> | null) => ({
  componentes: extractComponentes(config).map((item) => ({ ...item })),
});

const mapTurnoId = (turno: keyof TurnosState) => {
  if (turno === "Manhã") return "matinal";
  if (turno === "Tarde") return "tarde";
  return "noite";
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
  const { escolaId: escolaUuid, escolaSlug } = useEscolaId();
  
  // Prefer the explicit page/route escola parameter. Falling back to the
  // profile-level escola can load another school's academic session here.
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
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear());
  const [anoLetivoId, setAnoLetivoId] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [dataFim, setDataFim] = useState<string>(`${new Date().getFullYear()}-12-31`);
  const [periodosConfig, setPeriodosConfig] = useState<PeriodoConfig[]>([
    { numero: 1, data_inicio: `${new Date().getFullYear()}-01-01`, data_fim: `${new Date().getFullYear()}-04-30`, trava_notas_em: "" },
    { numero: 2, data_inicio: `${new Date().getFullYear()}-05-01`, data_fim: `${new Date().getFullYear()}-08-31`, trava_notas_em: "" },
    { numero: 3, data_inicio: `${new Date().getFullYear()}-09-01`, data_fim: `${new Date().getFullYear()}-12-31`, trava_notas_em: "" },
  ]);
  const [turnos, setTurnos] = useState<TurnosState>({ "Manhã": true, "Tarde": true, "Noite": false });
  const [sessaoAtiva, setSessaoAtiva] = useState<AcademicSession | null>(null);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [creatingSession, setCreatingSession] = useState(false);

  // --- STATES (STEP 2) ---
  const [frequenciaModelo, setFrequenciaModelo] = useState<'POR_AULA' | 'POR_PERIODO'>('POR_AULA');
  const [frequenciaMinPercent, setFrequenciaMinPercent] = useState<number>(75);
  const [modelosAvaliacao, setModelosAvaliacao] = useState<ModeloAvaliacao[]>([]);
  const [modeloAvaliacao, setModeloAvaliacao] = useState<string>('');
  const [avaliacaoConfig, setAvaliacaoConfig] = useState<any>({ componentes: [] });
  const [loadingConfig, setLoadingConfig] = useState(false);

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

  const supabase = useMemo(() => createClient(), []);
  const presetCacheRef = useRef<Record<string, Array<{ nome: string; classe: string; horas: number }>>>({});
  
  // Handlers
  const handleTurnoToggle = (t: keyof TurnosState) => setTurnos(p => ({ ...p, [t]: !p[t] }));

  // Fetch School Name (API)
  useEffect(() => {
    async function fn() {
      try {
        if (!isContextReady) return;
        const res = await fetch(`/api/escolas/${escolaContextId}/nome`, { cache: "no-store" });
        const j = await res.json();
        const n = j?.nome ?? j?.data?.nome;
        const nif = j?.nif ?? j?.data?.nif;
        const plano = j?.plano ?? j?.data?.plano;
        
        if (n) setSchoolDisplayName(prev => prev === n ? prev : n);
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
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || "Falha ao carregar sessão acadêmica.");
        }

        const sessions = Array.isArray(json?.data) ? (json.data as AcademicSession[]) : [];
        const activeSession = sessions.find((session) => session.status === "ativa") ?? sessions[0] ?? null;
        const loadedPeriods = Array.isArray(json?.periodos)
          ? (json.periodos as Array<Periodo & { trava_notas_em?: string | null }>)
          : [];

        setPeriodos(loadedPeriods);

        if (activeSession) {
          setSessaoAtiva(activeSession);
          setAnoLetivoId(activeSession.id);
          const parsedAno = Number(activeSession.ano_letivo);
          if (Number.isFinite(parsedAno)) setAnoLetivo(parsedAno);
          setDataInicio(toDateInput(activeSession.data_inicio));
          setDataFim(toDateInput(activeSession.data_fim));
        } else {
          setSessaoAtiva(null);
          setAnoLetivoId(null);
        }

        if (loadedPeriods.length > 0) {
          setPeriodosConfig(
            loadedPeriods
              .filter((periodo) => Number.isFinite(Number(periodo.numero)))
              .sort((a, b) => Number(a.numero) - Number(b.numero))
              .map((periodo) => ({
                numero: Number(periodo.numero),
                data_inicio: toDateInput(periodo.data_inicio),
                data_fim: toDateInput(periodo.data_fim),
                trava_notas_em: toDateTimeLocalInput(periodo.trava_notas_em),
              })),
          );
        }
      } catch (e) {
        console.error(e);
        warning(e instanceof Error ? e.message : "Falha ao carregar sessão acadêmica.");
      }
    }

    loadActiveSession();
  }, [isContextReady, escolaContextId]);

  const handleCreateSession = async () => {
    if (!isContextReady) return false;
    setCreatingSession(true);
    const tid = toast({ variant: "syncing", title: "Salvando sessão...", duration: 0 });
    try {
      const r1 = await fetch(`/api/escola/${escolaParam}/admin/ano-letivo/upsert`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ano: anoLetivo, data_inicio: dataInicio, data_fim: dataFim, ativo: true })
      });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1.error || "Erro na sessão");
      const aid = j1.data.id;
      const periods = periodosConfig.map(p => ({
        ano_letivo_id: aid, tipo: 'TRIMESTRE', numero: p.numero,
        data_inicio: p.data_inicio, data_fim: p.data_fim,
        trava_notas_em: p.trava_notas_em ? new Date(p.trava_notas_em).toISOString() : null
      }));
      const r2 = await fetch(`/api/escola/${escolaParam}/admin/periodos-letivos/upsert-bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(periods)
      });
      if (!r2.ok) throw new Error("Erro nos períodos");
      setAnoLetivoId(aid);
      setSessaoAtiva({ id: aid, nome: `Ano ${anoLetivo}`, ano_letivo: String(anoLetivo), data_inicio: dataInicio, data_fim: dataFim, status: 'ativa' });
      dismiss(tid);
      success("Sessão configurada.");
      return true;
    } catch (e: any) {
      dismiss(tid);
      error(e.message);
      return false;
    } finally { setCreatingSession(false); }
  };

  const handleSavePreferences = async () => {
    if (!isContextReady) return false;
    const tid = toast({ variant: "syncing", title: "Salvando regras...", duration: 0 });
    try {
      const r = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/avaliacao-frequencia`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequencia_modelo: frequenciaModelo, frequencia_min_percent: frequenciaMinPercent, modelo_avaliacao: modeloAvaliacao, avaliacao_config: avaliacaoConfig })
      });
      if (!r.ok) throw new Error("Erro ao salvar regras");
      dismiss(tid);
      success("Regras salvas.");
      return true;
    } catch (e: any) {
      dismiss(tid);
      error(e.message);
      return false;
    }
  };

  const loadPresetBlueprint = async (presetKey: string) => {
    if (!isContextReady) throw new Error("Escola não resolvida.");
    if (presetCacheRef.current[presetKey]) return presetCacheRef.current[presetKey];
    const { data, error: err } = await supabase.from("curriculum_preset_subjects").select("name, grade_level, weekly_hours").eq("preset_id", presetKey);
    if (err) throw err;
    const blueprint = (data || []).map(r => ({ nome: r.name, classe: r.grade_level, horas: r.weekly_hours }));
    presetCacheRef.current[presetKey] = blueprint;
    return blueprint;
  };

  const handleApplyCurriculumPreset = async () => {
    if (!matrix.length) return error("Matriz vazia.");
    if (!isContextReady) return error("Contexto não pronto.");
    setApplyingPreset(true);
    let tid = toast({ variant: "syncing", title: "Processando matriz...", duration: 0 });
    try {
      const grouped = matrix.reduce((acc, row) => {
        if (!acc[row.cursoKey]) acc[row.cursoKey] = { rows: [] };
        acc[row.cursoKey].rows.push(row);
        return acc;
      }, {} as any);
      const applied: any = {};
      for (const k in grouped) {
        const { rows } = grouped[k];
        const bp = await loadPresetBlueprint(k);
        const subjects = Array.from(new Set(bp.map(d => d.nome)));
        const classes = rows.map(r => r.nome);
        const tp = { manha: turnos["Manhã"], tarde: turnos["Tarde"], noite: turnos["Noite"] };
        const r = await fetch(`/api/escola/${escolaParam}/admin/curriculo/install-preset`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presetKey: k, ano_letivo_id: anoLetivoId, customData: { classes, subjects }, advancedConfig: { classes, subjects, turnos: tp }, options: { autoPublish: false, generateTurmas: false } })
        });
        const j = await r.json();
        if (j.applied?.curso_id) applied[k] = { cursoId: j.applied.curso_id, classes, version: j.applied.version };
      }
      setAppliedCursos(applied);
      dismiss(tid);
      success("Estrutura criada.");
      setStep(4);
    } catch (e: any) {
      dismiss(tid);
      error(e.message);
    } finally { setApplyingPreset(false); }
  };

  const handleGenerateTurmas = async () => {
    if (!isContextReady) return error("Contexto não pronto.");
    const tid = toast({ variant: "syncing", title: "Finalizando...", duration: 0 });
    try {
      // Simulação simplificada para onboarding
      await fetch(`/api/escolas/${escolaContextId}/onboarding/core/finalize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "academico", iban, valorMatricula, valorMensalidade, diaVencimento, anoLetivo, schoolName: schoolDisplayName })
      });
      dismiss(tid);
      success("Configuração concluída!");
      setShowFinalSuccess(true);
      setTimeout(() => { if (onComplete) onComplete(); else window.location.href = `/escola/${escolaParam}/admin/dashboard`; }, 2000);
    } catch (e: any) {
      dismiss(tid);
      error(e.message);
    }
  };

  const handleQuickStart = async () => {
    if (!isContextReady) return;
    let tid = toast({ variant: "syncing", title: "Configurando expresso...", duration: 0 });
    try {
      if (await handleCreateSession()) {
        await handleSavePreferences();
        await fetch(`/api/escolas/${escolaContextId}/onboarding/core/finalize`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "academico", iban, valorMatricula: 5000, valorMensalidade: 15000, diaVencimento: 5, anoLetivo, schoolName: schoolDisplayName })
        });
        dismiss(tid);
        success("Setup concluído!");
        setTimeout(() => { if (onComplete) onComplete(); else window.location.href = `/escola/${escolaParam}/admin/dashboard`; }, 1500);
      }
    } catch (e: any) { dismiss(tid); error(e.message); }
  };

  const handleNext = async () => {
    if (step === 1) { if (await handleCreateSession()) setStep(2); return; }
    if (step === 2) { if (await handleSavePreferences()) setStep(3); return; }
    if (step === 3) { await handleApplyCurriculumPreset(); return; }
    if (step === 4) { setStep(5); return; }
    if (step === 5) { await handleGenerateTurmas(); }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 font-sans">
      <div className="mx-auto mb-10 max-w-5xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#1F6B3B]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B]">
          <School className="h-3 w-3" /> Setup Inicial
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Setup do {schoolDisplayName || "Sistema"}</h1>
        {step === 1 && (
          <div className="mt-6">
            <button onClick={() => confirm("Deseja usar as configurações padrão?") && handleQuickStart()} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-xs font-bold text-white transition-all hover:scale-105 active:scale-95">
              <Wand2 className="h-3.5 w-3.5 text-klasse-gold" /> Configuração Rápida (Expresso)
            </button>
          </div>
        )}
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
