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
  ChevronDown,
  Info,
  CalendarDays
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { useEscolaId } from "@/hooks/useEscolaId";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

// Componentes Filhos
import AcademicStep1 from "./AcademicStep1";
import AcademicStep2 from "./AcademicStep2";
import AcademicStep2Config from "./AcademicStep2Config";
import AcademicStepFinancial from "./AcademicStepFinancial";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { ConfirmacaoContextual } from "@/components/harmonia";
import { invalidateSetupStateCache } from "@/lib/setupStateClient";

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

type PricingRule = {
  id: string;
  cursoNome: string;
  classeNome: string;
  valorMatricula: number;
  valorMensalidade: number;
};

type WizardStatusMeta = {
  badge: string;
  title: string;
  description: string;
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

const buildRecommendedLock = (dateValue?: string | null) => {
  if (!dateValue) return "";
  const lockDate = new Date(`${dateValue}T23:59:00`);
  if (Number.isNaN(lockDate.getTime())) return "";
  lockDate.setDate(lockDate.getDate() + 15);
  return lockDate.toISOString().slice(0, 16);
};

const safeFormatDate = (dateStr?: string | null, formatStr: string = "dd/MM/yyyy") => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return format(date, formatStr, { locale: pt });
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
          trava_notas_em: buildRecommendedLock(i.data_fim)
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
  const [modelosAvaliacao, setModelosAvaliacao] = useState<Array<{ id: string; nome: string; isDefault?: boolean }>>([]);
  const [modelosAvaliacaoConfigMap, setModelosAvaliacaoConfigMap] = useState<Record<string, Array<{ code: string; peso: number; ativo: boolean }>>>({});
  const [modeloAvaliacao, setModeloAvaliacao] = useState<string>('');
  const [avaliacaoConfig, setAvaliacaoConfig] = useState<any>({ componentes: [] });
  const [loadingModelosAvaliacao, setLoadingModelosAvaliacao] = useState(false);
  const [recommendedModeloId, setRecommendedModeloId] = useState<string>("");

  // --- STATES (STEP 4) ---
  const [valorMatricula, setValorMatricula] = useState<number>(0);
  const [valorMensalidade, setValorMensalidade] = useState<number>(0);
  const [diaVencimento, setDiaVencimento] = useState<number>(5);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);

  // --- STATES (STEP 3 & 5) ---
  const [presetCategory, setPresetCategory] = useState<CurriculumCategory>("geral");
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [padraoNomenclatura, setPadraoNomenclatura] = useState<PadraoNomenclatura>('descritivo_completo');
  const [appliedCursos, setAppliedCursos] = useState<Record<string, { cursoId: string; classes: string[]; version?: number | null }>>({});
  const [curriculumOverrides, setCurriculumOverrides] = useState<Record<string, number>>({});
  const [showFinalSuccess, setShowFinalSuccess] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const totalTurmas = useMemo(() => {
    let count = 0;
    matrix.forEach((row) => {
      if (turnos["Manhã"]) count += Number(row.manha || 0);
      if (turnos["Tarde"]) count += Number(row.tarde || 0);
      if (turnos["Noite"]) count += Number(row.noite || 0);
    });
    return count;
  }, [matrix, turnos]);

  const sampleNomeTurma = useMemo(() => {
    if (!matrix[0]) return "Ex: Informática 10ª Turma A";
    const primeiraClasse = matrix[0];
    const cursoNome = primeiraClasse?.cursoNome || "Curso";
    const classeNome = primeiraClasse?.nome || "10ª Classe";
    const turnoAtivo = turnos["Manhã"] ? "manha" : turnos["Tarde"] ? "tarde" : "noite";
    
    const sigla = cursoNome.substring(0,3).toUpperCase();
    const ano = anoLetivo ? `(${anoLetivo})` : "";
    const turnoCode = turnoAtivo.toUpperCase().charAt(0);
    const turnoLabel = turnoCode === "M" ? "Manhã" : turnoCode === "T" ? "Tarde" : "Noite";
    const classeLimpa = `${classeNome.replace(/\D/g, "")}ª`;
    const letra = "A";

    switch (padraoNomenclatura) {
      case "descritivo_completo": return `${cursoNome} ${classeLimpa} Turma ${letra} ${ano}`.trim();
      case "descritivo_simples": return `${sigla} - ${classeLimpa} Turma ${letra} - ${turnoLabel}`;
      case "abreviado": return `${sigla}-${classeLimpa.replace("ª", "")}-${turnoCode}-${letra}`;
      default: return `${cursoNome} ${classeLimpa}`;
    }
  }, [matrix, turnos, padraoNomenclatura, anoLetivo]);

  const handleTurnoToggle = (t: keyof TurnosState) => setTurnos(p => ({ ...p, [t]: !p[t] }));

  const applyRecommendedLocks = () => {
    setPeriodosConfig((prev) =>
      prev.map((periodo) => ({
        ...periodo,
        trava_notas_em: buildRecommendedLock(periodo.data_fim),
      }))
    );
  };

  const handlePeriodoChange = (
    numero: number,
    field: "data_inicio" | "data_fim" | "trava_notas_em",
    value: string
  ) => {
    setPeriodosConfig((prev) =>
      prev.map((periodo) => {
        if (periodo.numero !== numero) return periodo;
        if (field !== "data_fim") return { ...periodo, [field]: value };

        const previousRecommended = buildRecommendedLock(periodo.data_fim);
        const nextRecommended = buildRecommendedLock(value);
        const shouldAutoUpdateLock =
          !periodo.trava_notas_em || periodo.trava_notas_em === previousRecommended;

        return {
          ...periodo,
          data_fim: value,
          trava_notas_em: shouldAutoUpdateLock ? nextRecommended : periodo.trava_notas_em,
        };
      })
    );
  };

  useEffect(() => {
    const nextRules = matrix
      .filter((row) => row.nome && row.cursoNome)
      .map((row) => ({
        id: `${row.cursoNome}::${row.nome}`,
        cursoNome: row.cursoNome || "Curso sem nome",
        classeNome: row.nome,
      }));

    setPricingRules((prev) => {
      const prevMap = new Map(prev.map((rule) => [rule.id, rule]));
      return nextRules.map((rule) => {
        const existing = prevMap.get(rule.id);
        return existing ?? {
          ...rule,
          valorMatricula,
          valorMensalidade,
        };
      });
    });
  }, [matrix]);

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

  useEffect(() => {
    async function loadEvaluationModels() {
      try {
        if (!isContextReady) return;
        setLoadingModelosAvaliacao(true);

        const [configRes, modelosRes] = await Promise.all([
          fetch(`/api/escola/${escolaParam}/admin/configuracoes/avaliacao-frequencia`, { cache: "no-store" }),
          fetch(`/api/escolas/${escolaContextId}/modelos-avaliacao?limit=50`, { cache: "no-store" }),
        ]);

        const configJson = await configRes.json().catch(() => null);
        const modelosJson = await modelosRes.json().catch(() => null);

        const remoteModelos: Array<{
          id: string;
          nome: string;
          isDefault: boolean;
          componentes: Array<{ code: string; peso: number; ativo: boolean }>;
        }> = Array.isArray(modelosJson?.data)
          ? modelosJson.data.map((item: any) => ({
              id: String(item.id),
              nome: String(item.nome),
              isDefault: Boolean(item.is_default),
              componentes: Array.isArray(item.componentes)
                ? item.componentes
                : Array.isArray(item.componentes?.componentes)
                  ? item.componentes.componentes
                  : [],
            }))
          : [];

        const fallbackModelos: Array<{
          id: string;
          nome: string;
          isDefault: boolean;
          componentes: Array<{ code: string; peso: number; ativo: boolean }>;
        }> = remoteModelos.length > 0
          ? remoteModelos
          : [{
              id: "SIMPLIFICADO",
              nome: "Modelo Simplificado",
              isDefault: true,
              componentes: [
                { code: "MAC", peso: 40, ativo: true },
                { code: "NPP", peso: 60, ativo: true },
              ],
            }];

        setModelosAvaliacaoConfigMap(
          fallbackModelos.reduce<Record<string, Array<{ code: string; peso: number; ativo: boolean }>>>((acc, item) => {
            acc[item.id] = Array.isArray(item.componentes) ? item.componentes : [];
            return acc;
          }, {})
        );

        setModelosAvaliacao(
          fallbackModelos.map((item) => ({
            id: item.id,
            nome: item.nome,
            isDefault: item.isDefault,
          }))
        );

        const defaultModelo = fallbackModelos.find((item) => item.isDefault) ?? fallbackModelos[0] ?? null;
        const savedModelRef = String(configJson?.data?.modelo_avaliacao ?? "").trim();
        const savedModel =
          fallbackModelos.find((item) => item.id === savedModelRef) ??
          fallbackModelos.find((item) => item.nome === savedModelRef) ??
          null;
        const activeModel = savedModel ?? defaultModelo;

        if (activeModel) {
          setRecommendedModeloId(defaultModelo?.id ?? activeModel.id);
          setModeloAvaliacao((current) => current || activeModel.id);
        }

        const configComponentes = configJson?.data?.avaliacao_config?.componentes;
        if (Array.isArray(configComponentes) && configComponentes.length > 0) {
          setAvaliacaoConfig({ componentes: configComponentes });
        } else if (activeModel?.componentes?.length) {
          setAvaliacaoConfig({ componentes: activeModel.componentes });
        }

        if (configJson?.data) {
          setFrequenciaModelo(configJson.data.frequencia_modelo ?? 'POR_AULA');
          setFrequenciaMinPercent(configJson.data.frequencia_min_percent ?? 75);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingModelosAvaliacao(false);
      }
    }

    loadEvaluationModels();
  }, [isContextReady, escolaContextId, escolaParam]);

  const handleCreateSession = async () => {
    if (!isContextReady) return false;
    setCreatingSession(true);
    const tid = toast({ variant: "syncing", title: "Salvando sessão...", duration: 0 });
    try {
      const res = await fetch(`/api/escolas/${escolaContextId}/onboarding/core/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          anoLetivo,
          data_inicio: dataInicio,
          data_fim: dataFim,
          esquemaPeriodos: 'trimestral',
          templateId: selectedTemplateId || undefined,
          periodosConfig: periodosConfig.map((periodo) => ({
            numero: periodo.numero,
            data_inicio: periodo.data_inicio,
            data_fim: periodo.data_fim,
            trava_notas_em: periodo.trava_notas_em
              ? new Date(periodo.trava_notas_em).toISOString()
              : "",
          })),
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
      setStep(4);
      dismiss(tid);
      success("Matriz confirmada.");
    } catch (e: any) { dismiss(tid); error("Erro"); } finally { setApplyingPreset(false); }
  };

  const handleGenerateTurmas = async () => {
    if (!isContextReady) return;
    setFinalizing(true);
    try {
      const response = await fetch(`/api/escolas/${escolaContextId}/onboarding/core/finalize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "academico",
          iban,
          valorMatricula,
          valorMensalidade,
          diaVencimento,
          anoLetivo,
          schoolName: schoolDisplayName,
          pricingRules,
          turnos,
          matrix,
        })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao finalizar o setup.");
      }
      if (escolaContextId) {
        invalidateSetupStateCache(escolaContextId);
      }
      if (escolaUuidResolved) {
        invalidateSetupStateCache(escolaUuidResolved);
      }
      success("Concluído!");
      setShowFinalSuccess(true);
      setTimeout(() => { if (onComplete) onComplete(); else window.location.href = `/escola/${escolaParam}/admin/dashboard`; }, 2000);
    } catch (e: any) {
      error(e?.message || "Erro final");
    } finally {
      setFinalizing(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) { if (await handleCreateSession()) setStep(2); return; }
    if (step === 2) { if (await handleSavePreferences()) setStep(3); return; }
    if (step === 3) { await handleApplyCurriculumPreset(); return; }
    if (step === 4) { setStep(5); return; }
    if (step === 5) { await handleGenerateTurmas(); }
  };

  const handleModeloAvaliacaoChange = (nextModelId: string) => {
    setModeloAvaliacao(nextModelId);
    const nextComponentes = modelosAvaliacaoConfigMap[nextModelId];
    if (Array.isArray(nextComponentes) && nextComponentes.length > 0) {
      setAvaliacaoConfig({ componentes: nextComponentes });
    }
  };

  const selectedModeloMeta = modelosAvaliacao.find((item) => item.id === modeloAvaliacao);
  const wizardStatusMeta: WizardStatusMeta = step === 1
    ? {
        badge: "O que falta agora",
        title: "Configure o ano letivo e confirme os períodos.",
        description: "O sistema já sugere o travamento de notas 15 dias após o fim de cada trimestre para reduzir digitação manual.",
      }
    : step === 2
      ? {
          badge: "Próximo passo",
          title: selectedModeloMeta
            ? `Confirme as regras de avaliação com base em ${selectedModeloMeta.nome}.`
            : "Defina frequência e modelo de avaliação.",
          description: "Pode começar pelo modelo recomendado e ajustar depois, sem travar o setup.",
        }
      : step === 3
        ? {
            badge: "Próximo passo",
            title: "Monte a matriz e a estrutura de turmas.",
            description: "Nesta etapa a escola define a base operacional para currículo, classes e turnos.",
          }
        : step === 4
          ? {
              badge: "Próximo passo",
              title: "Confirme preços, matrícula e vencimento.",
              description: "Estes dados alimentam o financeiro inicial da escola e fazem parte do readiness operacional.",
            }
          : {
              badge: "Reta final",
              title: "Gerar os artefactos iniciais da escola.",
              description: "Ao finalizar, o setup base é concluído e a escola segue para a verificação de prontidão operacional.",
            };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 font-sans text-left">
      <div className="mx-auto mb-10 max-w-5xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#1F6B3B]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B]">
          <School className="h-3 w-3" /> Setup Inicial
        </div>
        <h1 className="text-3xl font-bold text-slate-900 text-center">Setup do {schoolDisplayName || "Sistema"}</h1>
      </div>

      <div className="mx-auto mb-8 max-w-5xl rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-5 text-left">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">{wizardStatusMeta.badge}</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">{wizardStatusMeta.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{wizardStatusMeta.description}</p>
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
              periodosConfig={periodosConfig} onPeriodoChange={handlePeriodoChange}
              turnos={turnos} onTurnoToggle={handleTurnoToggle} iban={iban} onIbanChange={setIban}
              sessaoAtiva={sessaoAtiva} periodos={periodos} creatingSession={creatingSession} onCreateSession={handleCreateSession}
              templates={templates} onApplyTemplate={applyTemplate} onApplyRecommendedLocks={applyRecommendedLocks}
            />
          )}
          {step === 2 && (
            <AcademicStep2Config
              frequenciaModelo={frequenciaModelo} onFrequenciaModeloChange={setFrequenciaModelo}
              frequenciaMinPercent={frequenciaMinPercent} onFrequenciaMinPercentChange={v => setFrequenciaMinPercent(Number(v))}
              modeloAvaliacao={modeloAvaliacao} onModeloAvaliacaoChange={handleModeloAvaliacaoChange}
              modelosAvaliacao={modelosAvaliacao} avaliacaoConfig={avaliacaoConfig}
              recommendedModeloId={recommendedModeloId}
              isLoadingModelos={loadingModelosAvaliacao}
            />
          )}
          {step === 3 && (
            <AcademicStep2
              escolaId={escolaUuidResolved || ""} presetCategory={presetCategory} onPresetCategoryChange={setPresetCategory}
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
              pricingRules={pricingRules}
              onPricingRuleChange={(id, field, value) =>
                setPricingRules((prev) =>
                  prev.map((rule) => (rule.id === id ? { ...rule, [field]: Number.isFinite(value) ? value : 0 } : rule))
                )
              }
              onApplyDefaultsToAll={() =>
                setPricingRules((prev) =>
                  prev.map((rule) => ({
                    ...rule,
                    valorMatricula,
                    valorMensalidade,
                  }))
                )
              }
            />
          )}
          {step === 5 && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="text-center max-w-xl mx-auto space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1F6B3B]/10 text-[#1F6B3B]">
                  <Wand2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Resumo e Preview de Geração</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Revise abaixo todos os parâmetros do ano letivo de {anoLetivo} antes de iniciar a geração dos registros no banco de dados.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                {/* CARD 1: CALENDÁRIO & PERÍODOS */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <CalendarCheck className="h-4 w-4 text-[#1F6B3B]" />
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Sessão & Trimestres</h4>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <p><strong>Período Letivo:</strong> {safeFormatDate(dataInicio)} a {safeFormatDate(dataFim)}</p>
                  </div>
                  <div className="space-y-2.5">
                    {periodosConfig.map((p) => (
                      <div key={p.numero} className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                          <span>{p.numero}º Trimestre</span>
                          <span className="text-[9px] text-[#1F6B3B] bg-[#1F6B3B]/10 px-1.5 py-0.5 rounded-md font-semibold">Ativo</span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Datas: {safeFormatDate(p.data_inicio)} a {safeFormatDate(p.data_fim)}
                        </p>
                        {p.trava_notas_em && (
                          <p className="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 inline-block font-mono font-semibold">
                            Bloqueio de Notas: {safeFormatDate(p.trava_notas_em, "dd/MM/yyyy HH:mm")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* CARD 2: REGRAS PEDAGÓGICAS */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <GraduationCap className="h-4 w-4 text-[#1F6B3B]" />
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Regras de Lançamento</h4>
                  </div>
                  <div className="space-y-3 text-xs text-slate-600">
                    <div>
                      <p className="font-semibold text-slate-800">Modelo de Avaliação:</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{selectedModeloMeta?.nome || "Modelo Padrão"}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {avaliacaoConfig?.componentes?.map((c: any) => (
                          <span key={c.code} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[9px] font-bold">
                            {c.code}: {c.peso}%
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-100 space-y-1">
                      <p><strong>Frequência Mínima:</strong> {frequenciaMinPercent}%</p>
                      <p><strong>Controle de Presença:</strong> {frequenciaModelo === "POR_AULA" ? "Por Aula (Carga Horária)" : "Por Período (Global)"}</p>
                    </div>
                  </div>
                </div>

                {/* CARD 3: ESTRUTURA ACADÉMICA (TURMAS) */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Layers className="h-4 w-4 text-[#1F6B3B]" />
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Estrutura & Turmas</h4>
                  </div>
                  <div className="space-y-3 text-xs text-slate-600">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-lg font-black text-slate-800">{matrix.length}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Classes Ativas</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-lg font-black text-[#1F6B3B]">{totalTurmas}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#1F6B3B]/70">Total Turmas</span>
                      </div>
                    </div>
                    <div className="pt-2 space-y-1.5">
                      <p><strong>Turnos Ativos:</strong> {Object.entries(turnos).filter(([_, active]) => active).map(([name]) => name).join(", ")}</p>
                      <p><strong>Exemplo de Nome:</strong> <code className="bg-slate-50 border border-slate-200/60 px-1 py-0.5 rounded text-[10.5px] font-mono text-slate-800 leading-normal">{sampleNomeTurma}</code></p>
                    </div>
                  </div>
                </div>

                {/* CARD 4: MENSALIDADES & PREÇOS */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Banknote className="h-4 w-4 text-[#1F6B3B]" />
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Financeiro Base</h4>
                  </div>
                  <div className="space-y-3 text-xs text-slate-600">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-base font-black text-slate-800">{valorMatricula.toLocaleString("pt-PT")} Kz</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Matrícula Padrão</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-base font-black text-slate-800">{valorMensalidade.toLocaleString("pt-PT")} Kz</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Propina Padrão</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <p><strong>Vencimento:</strong> Dia {diaVencimento} de cada mês</p>
                      <p><strong>IBAN da Escola:</strong> {iban || <span className="text-amber-600 font-semibold italic">Não configurado</span>}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* WARNING / NOTICE CARD */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4.5 text-center flex items-center justify-center gap-3 text-left">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                  Ao clicar em <strong>Finalizar</strong>, o sistema irá criar automaticamente o novo ano letivo, gerar os trimestres configurados, aplicar as regras de avaliação e instanciar as {totalTurmas} turmas e tabelas de propina.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-8 py-5">
          <button onClick={() => step > 1 && setStep(p => p - 1)} disabled={step === 1 || applyingPreset || finalizing} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <button onClick={handleNext} disabled={applyingPreset || creatingSession || finalizing || !isContextReady || (step === 3 && matrix.length === 0)} className="inline-flex items-center gap-2 rounded-xl bg-[#E3B23C] px-8 py-3 text-sm font-bold text-white shadow-md transition-all hover:brightness-105 disabled:opacity-50">
            {applyingPreset || creatingSession || finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : (step === 5 ? "Finalizar" : "Continuar")}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {showFinalSuccess && <ConfirmacaoContextual acaoId="matricula.confirmada.lote" contexto={{ total: matrix.length, tempo: "2s" }} onClose={() => {}} />}
    </div>
  );
}
