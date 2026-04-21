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
  CalendarCheck
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { useEscolaId } from "@/hooks/useEscolaId";

// Componentes Filhos (já refatorados anteriormente)
import AcademicStep1 from "./AcademicStep1";
import AcademicStep2 from "./AcademicStep2";
import AcademicStep2Config from "./AcademicStep2Config";
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
    { num: 4, label: "Gerar", icon: Wand2 },
  ];

  return (
    <div className="mx-auto mb-10 w-full max-w-3xl">
      <div className="relative flex justify-between">
        {/* Linha de Conexão de Fundo */}
        <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full -translate-y-1/2 bg-slate-200" />
        
        {/* Linha de Progresso Ativa */}
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
              <span className={`text-xs font-bold uppercase tracking-wider ${isActive || isCompleted ? "text-slate-900" : "text-slate-400"}`}>
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
  const escolaParam = escolaSlug || escolaId;
  const escolaUuidResolved = escolaUuid;
  const escolaContextId = escolaUuidResolved || escolaParam;
  const [step, setStep] = useState(1);

  // --- STATES (STEP 1) ---
  const [schoolDisplayName, setSchoolDisplayName] = useState<string>(initialSchoolName || "");
  const [schoolNif, setSchoolNif] = useState<string | null>(null);
  const [schoolPlan, setSchoolPlan] = useState<string | null>(null);
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear());
  const [anoLetivoId, setAnoLetivoId] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [dataFim, setDataFim] = useState<string>(`${new Date().getFullYear()}-12-31`);
  const [periodosConfig, setPeriodosConfig] = useState([
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

  // --- STATES (STEP 3 & 4) ---
  const [presetCategory, setPresetCategory] = useState<CurriculumCategory>("geral");
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [padraoNomenclatura, setPadraoNomenclatura] = useState<PadraoNomenclatura>('descritivo_completo');
  const [appliedCursos, setAppliedCursos] = useState<Record<string, { cursoId: string; classes: string[]; version?: number | null }>>({});
  const [curriculumOverrides, setCurriculumOverrides] = useState<Record<string, number>>({});
  const [estruturaCounts, setEstruturaCounts] = useState<{ cursos_total?: number; classes_total?: number; disciplinas_total?: number; } | null>(null);
  const [showFinalSuccess, setShowFinalSuccess] = useState(false);

  const supabase = useMemo(() => createClient(), []);
  const presetCacheRef = useRef<Record<string, Array<{ nome: string; classe: string; horas: number }>>>({});
  const sessionLoadedRef = useRef(false);
  const step1TouchedRef = useRef(false);

  // --- EFFECTS (Logic) ---
  
  // Init School Name
  useEffect(() => {
    if (initialSchoolName) setSchoolDisplayName(prev => prev || initialSchoolName);
  }, [initialSchoolName]);

  // Init Dates based on Year
  const buildDefaultPeriodos = (ano: number) => ([
    { numero: 1, data_inicio: `${ano}-01-01`, data_fim: `${ano}-04-30`, trava_notas_em: "" },
    { numero: 2, data_inicio: `${ano}-05-01`, data_fim: `${ano}-08-31`, trava_notas_em: "" },
    { numero: 3, data_inicio: `${ano}-09-01`, data_fim: `${ano}-12-31`, trava_notas_em: "" },
  ]);

  const parseDateOnlyUtc = (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return null;

    let y = 0;
    let m = 0;
    let d = 0;

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      y = Number(isoMatch[1]);
      m = Number(isoMatch[2]);
      d = Number(isoMatch[3]);
    }

    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!isoMatch && brMatch) {
      d = Number(brMatch[1]);
      m = Number(brMatch[2]);
      y = Number(brMatch[3]);
    }

    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  };

  const formatDateOnlyUtc = (date: Date) => date.toISOString().slice(0, 10);

  const addDaysUtc = (date: Date, days: number) => {
    const copy = new Date(date.getTime());
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  };

  const buildPeriodosFromRange = (
    start: string,
    end: string,
    current: Array<{ numero: number; data_inicio: string; data_fim: string; trava_notas_em: string }>
  ) => {
    const startDate = parseDateOnlyUtc(start);
    const endDate = parseDateOnlyUtc(end);
    if (!startDate || !endDate || endDate < startDate) return current;

    const count = Math.max(1, current.length || 3);
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    const baseSize = Math.floor(totalDays / count);
    let remainder = totalDays % count;

    const next = [];
    let cursor = startDate;
    for (let i = 0; i < count; i += 1) {
      const size = baseSize + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      const periodEnd = addDaysUtc(cursor, Math.max(0, size - 1));
      next.push({
        numero: current[i]?.numero ?? i + 1,
        data_inicio: formatDateOnlyUtc(cursor),
        data_fim: formatDateOnlyUtc(periodEnd),
        trava_notas_em: current[i]?.trava_notas_em ?? "",
      });
      cursor = addDaysUtc(periodEnd, 1);
    }

    return next;
  };

  useEffect(() => {
    // Quando já existe sessão ativa carregada do backend, não sobrescrever
    // o intervalo real com o padrão Jan-Dez do ano numérico.
    if (sessionLoadedRef.current) return;
    setDataInicio(`${anoLetivo}-01-01`);
    setDataFim(`${anoLetivo}-12-31`);
    setPeriodosConfig(buildDefaultPeriodos(anoLetivo));
  }, [anoLetivo]);

  const periodosConfigDerived = useMemo(
    () => buildPeriodosFromRange(dataInicio, dataFim, periodosConfig),
    [dataInicio, dataFim, periodosConfig]
  );

  // Fetch Session
  useEffect(() => {
    let cancelled = false;
    async function fetchSession() {
      if (!escolaUuidResolved) return;
      try {
        const { data: ano } = await supabase.from('anos_letivos').select('*').eq('escola_id', escolaUuidResolved).eq('ativo', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!cancelled && ano) {
          if (step1TouchedRef.current) return;
          sessionLoadedRef.current = true;
          setAnoLetivo(ano.ano);
          setAnoLetivoId(ano.id);
          setDataInicio(ano.data_inicio);
          setDataFim(ano.data_fim);
          setSessaoAtiva({ id: ano.id, nome: `Ano ${ano.ano}`, ano_letivo: String(ano.ano), data_inicio: ano.data_inicio, data_fim: ano.data_fim, status: ano.ativo ? 'ativa' : 'arquivada' });
          
          const { data: pDb } = await supabase
            .from('periodos_letivos')
            .select('*')
            .eq('escola_id', escolaUuidResolved)
            .eq('ano_letivo_id', ano.id)
            .order('numero');

          if (Array.isArray(pDb) && pDb.length > 0) {
            setPeriodos(pDb.map((p: any) => ({ ...p, nome: `Trimestre ${p.numero}`, sessao_id: ano.id })));
            const mapped = pDb.map((p: any) => ({
              numero: p.numero,
              data_inicio: p.data_inicio,
              data_fim: p.data_fim,
              trava_notas_em: p.trava_notas_em ? String(p.trava_notas_em).slice(0, 16) : "",
            }));
            setPeriodosConfig(buildPeriodosFromRange(ano.data_inicio, ano.data_fim, mapped));
          } else {
            // Mantém a seção de períodos visível para configuração inicial.
            setPeriodos([]);
            setPeriodosConfig(
              buildPeriodosFromRange(
                ano.data_inicio,
                ano.data_fim,
                buildDefaultPeriodos(ano.ano)
              )
            );
          }
        }
      } catch (e) { console.error(e); }
    }
    if (escolaUuidResolved) fetchSession();
    return () => { cancelled = true; };
  }, [escolaUuidResolved, supabase]);

  // Fetch School Name (API)
  useEffect(() => {
    async function fn() {
      try {
        if (!escolaContextId) return;
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
    if (escolaContextId) fn();
  }, [escolaContextId]);

  useEffect(() => {
    let active = true;
    async function loadDraft() {
      if (!escolaContextId) return;
      if (Object.keys(curriculumOverrides).length > 0) return;
      try {
        const res = await fetch(`/api/escolas/${escolaContextId}/onboarding/draft`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const overrides = json?.draft?.data?.curriculumOverrides;
        if (active && overrides && typeof overrides === "object") {
          setCurriculumOverrides(overrides as Record<string, number>);
        }
      } catch (_) {
        // ignore
      }
    }
    loadDraft();
    return () => {
      active = false;
    };
  }, [escolaContextId, curriculumOverrides]);

  // Fetch Config (Step 2)
  useEffect(() => {
    let active = true;
    async function fn() {
      if (!escolaParam) return;
      setLoadingConfig(true);
      try {
        if (!escolaContextId) return;
        const [configRes, modelosRes] = await Promise.all([
          fetch(`/api/escola/${escolaParam}/admin/configuracoes/avaliacao-frequencia`, { cache: "no-store" }),
          fetch(`/api/escolas/${escolaContextId}/modelos-avaliacao?limit=50`, { cache: "no-store" }),
        ]);
        const j = await configRes.json();
        const modelosJson = await modelosRes.json().catch(() => null);
        if (!active) return;
        const listaModelos = Array.isArray(modelosJson?.data) ? modelosJson.data : [];
        setModelosAvaliacao(listaModelos);
        const defaultModelo = listaModelos.find((m: ModeloAvaliacao) => m.is_default) ?? listaModelos[0];
        const d = j?.data || {};
        setFrequenciaModelo(d.frequencia_modelo || 'POR_AULA');
        setFrequenciaMinPercent(Number.isFinite(d.frequencia_min_percent) ? d.frequencia_min_percent : 75);
        const modelId = listaModelos.find((m: ModeloAvaliacao) => m.id === d.modelo_avaliacao)?.id
          ?? listaModelos.find((m: ModeloAvaliacao) => m.nome === d.modelo_avaliacao)?.id
          ?? defaultModelo?.id
          ?? '';
        setModeloAvaliacao(modelId);
        if (d.avaliacao_config?.componentes?.length) {
          setAvaliacaoConfig(cloneConfig(d.avaliacao_config));
        } else if (defaultModelo) {
          setAvaliacaoConfig(cloneConfig(defaultModelo.componentes));
        }
      } catch (e) { console.error(e); } 
      finally { if(active) setLoadingConfig(false); }
    }
    fn();
    return () => { active = false; };
  }, [escolaParam, escolaContextId]);

  // Fetch Counts
  useEffect(() => {
    let active = true;
    async function fn() {
      if (!escolaParam) return;
      try {
        const r = await fetch(`/api/escola/${escolaParam}/admin/setup/status`, { cache: "no-store" });
        const j = await r.json();
        if (active && j?.data?.estrutura_counts) setEstruturaCounts(j.data.estrutura_counts);
      } catch (e) { console.error(e); }
    }
    fn();
    return () => { active = false; };
  }, [escolaParam]);

  // --- HANDLERS ---
  const handleTurnoToggle = (t: keyof TurnosState) => setTurnos(p => ({ ...p, [t]: !p[t] }));
  const markStep1Touched = () => {
    step1TouchedRef.current = true;
  };

  const handleCreateSession = async () => {
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

      const periods = periodosConfigDerived.map(p => ({
        ano_letivo_id: aid, tipo: 'TRIMESTRE', numero: p.numero,
        data_inicio: p.data_inicio, data_fim: p.data_fim,
        trava_notas_em: p.trava_notas_em ? new Date(p.trava_notas_em).toISOString() : null
      }));

      const r2 = await fetch(`/api/escola/${escolaParam}/admin/periodos-letivos/upsert-bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(periods)
      });
      if (!r2.ok) throw new Error("Erro nos períodos");
      const j2 = await r2.json();

      setAnoLetivoId(aid);
      setSessaoAtiva({ id: aid, nome: `Ano ${anoLetivo}`, ano_letivo: String(anoLetivo), data_inicio: dataInicio, data_fim: dataFim, status: 'ativa' });
      setPeriodos(j2.data || []);
      dismiss(tid);
      success("Ano letivo configurado.");
      return true;
    } catch (e: any) {
      dismiss(tid);
      error(e.message);
      return false;
    } finally { setCreatingSession(false); }
  };

  const handleSavePreferences = async () => {
    const tid = toast({ variant: "syncing", title: "Salvando regras...", duration: 0 });
    try {
      const modeloAvaliacaoPayload =
        (modeloAvaliacao && modeloAvaliacao.trim()) ||
        (modelosAvaliacao[0]?.id ?? "");

      const r = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/avaliacao-frequencia`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequencia_modelo: frequenciaModelo,
          frequencia_min_percent: frequenciaMinPercent,
          modelo_avaliacao: modeloAvaliacaoPayload,
          avaliacao_config: avaliacaoConfig
        })
      });
      if (!r.ok) {
        const json = await r.json().catch(() => null);
        const issues = Array.isArray(json?.issues)
          ? json.issues.map((issue: any) => issue.message).join(", ")
          : "";
        throw new Error(issues || json?.error || "Erro ao salvar regras");
      }
      dismiss(tid);
      success("Regras salvas.");
      return true;
    } catch (e: any) {
      dismiss(tid);
      error(e.message);
      return false;
    }
  };

  const handleMatrixUpdate = (id: string|number, f: "manha"|"tarde"|"noite", v: string) => {
    const n = parseInt(v) || 0;
    setMatrix(p => p.map(r => r.id === id ? { ...r, [f]: Math.max(0, n) } : r));
  };

  const loadPresetBlueprint = async (presetKey: string) => {
    if (!escolaUuidResolved) {
      throw new Error("Escola ainda não resolvida.");
    }
    if (presetCacheRef.current[presetKey]) return presetCacheRef.current[presetKey];

    const { data: presetRows, error: presetErr } = await supabase
      .from("curriculum_preset_subjects")
      .select("id, name, grade_level, weekly_hours")
      .eq("preset_id", presetKey);

    if (presetErr) throw presetErr;

    const presetIds = (presetRows || []).map((row: any) => row.id).filter(Boolean);
    let schoolMap = new Map<string, any>();
    if (presetIds.length > 0) {
      const { data: schoolRows, error: schoolErr } = await supabase
        .from("school_subjects")
        .select("preset_subject_id, custom_name, custom_weekly_hours, is_active")
        .eq("escola_id", escolaUuidResolved)
        .in("preset_subject_id", presetIds);
      if (schoolErr) throw schoolErr;
      schoolMap = new Map((schoolRows || []).map((row: any) => [row.preset_subject_id, row]));
    }

    const blueprint = (presetRows || [])
      .map((row: any) => {
        const override = schoolMap.get(row.id);
        if (override?.is_active === false) return null;
        return {
          nome: String(override?.custom_name ?? row.name ?? "").trim(),
          classe: String(row.grade_level ?? "").trim(),
          horas: Number(override?.custom_weekly_hours ?? row.weekly_hours ?? 0),
        };
      })
      .filter(
        (row): row is { nome: string; classe: string; horas: number } =>
          Boolean(row && row.nome && row.classe)
      );

    presetCacheRef.current[presetKey] = blueprint;
    return blueprint;
  };

  const resolvePublishNetworkIssue = (err: unknown) => {
    const message = String((err as any)?.message ?? "").toLowerCase();
    const isNavigatorOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    const isTransientNetwork =
      isNavigatorOffline ||
      message.includes("err_network_changed") ||
      message.includes("network changed") ||
      message.includes("failed to fetch") ||
      message.includes("load failed") ||
      message.includes("networkerror");

    if (!isTransientNetwork) return null;

    return {
      title: "Falha de conexão ao publicar currículo.",
      detail:
        "A conexão de rede mudou durante o setup. Verifique internet/VPN e execute novamente.",
    };
  };

  const handleApplyCurriculumPreset = async () => {
    if (!matrix.length) return error("Matriz vazia.");
    if (!anoLetivoId) return error("Sessão não definida.");
    if (!escolaContextId) return error("Escola ainda não resolvida.");
    
    setApplyingPreset(true);
    let tid = toast({ variant: "syncing", title: "Criando cursos e disciplinas...", duration: 0 });
    
    try {
      const grouped = matrix.reduce((acc, row) => {
        if (!acc[row.cursoKey]) acc[row.cursoKey] = { cursoNome: row.cursoNome||row.cursoKey, rows: [] };
        acc[row.cursoKey].rows.push(row);
        return acc;
      }, {} as any);

      const applied: any = {};
      const cursosList = await fetchAllPaginated<any>(`/api/escolas/${escolaContextId}/cursos`);

      for (const k in grouped) {
        const { cursoNome, rows } = grouped[k];
        dismiss(tid);
        tid = toast({ variant: "syncing", title: `Processando ${cursoNome}...`, duration: 0 });
        
        const bp = await loadPresetBlueprint(k);
        const subjects = Array.from(new Set(bp.map((d: any) => d.nome)));
        const classes = rows.map((r: any) => r.nome);
        const classSet = new Set(classes);

        const cargaByClass: Record<string, number> = {};
        bp.forEach((disciplina: any) => {
          const nome = String(disciplina?.nome ?? '').trim();
          const classe = String(disciplina?.classe ?? '').trim();
          if (!nome || !classe || !classSet.has(classe)) return;
          if (Number.isFinite(disciplina?.horas)) {
            cargaByClass[`${nome}::${classe}`] = Number(disciplina.horas);
          }
        });

        const overridePrefix = `${k}::`;
        Object.entries(curriculumOverrides).forEach(([key, value]) => {
          if (!key.startsWith(overridePrefix)) return;
          const remainder = key.slice(overridePrefix.length);
          const [classe, ...subjectParts] = remainder.split("::");
          const subject = subjectParts.join("::");
          if (!classe || !subject || !classSet.has(classe)) return;
          if (Number.isFinite(value)) {
            cargaByClass[`${subject}::${classe}`] = Number(value);
          }
        });
        
        const matrixMap: any = {};
        const tp = { manha: turnos["Manhã"], tarde: turnos["Tarde"], noite: turnos["Noite"] };
        
        for (const r of rows) {
          for (const s of subjects) {
            if (tp.manha) matrixMap[`${s}::${r.nome}::M`] = true;
            if (tp.tarde) matrixMap[`${s}::${r.nome}::T`] = true;
            if (tp.noite) matrixMap[`${s}::${r.nome}::N`] = true;
          }
        }

        const r = await fetch(`/api/escola/${escolaParam}/admin/curriculo/install-preset`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetKey: k, ano_letivo_id: anoLetivoId,
            customData: { label: cursoNome, associatedPreset: k, classes, subjects },
            advancedConfig: { classes, subjects, matrix: matrixMap, turnos: tp, cargaByClass },
            options: { autoPublish: false, generateTurmas: false }
          })
        });
        const j = await r.json();
        if (!r.ok) {
          throw new Error(
            j?.message ||
            j?.error ||
            `Falha ao aplicar ${cursoNome}: já existe currículo publicado para este curso/ano letivo.`
          );
        }
        if (j?.applied?.skipped) {
          const skipMessage =
            j?.applied?.message ||
            "Preset não aplicado porque já existe currículo publicado para o curso/ano letivo.";
          warning("Preset já publicado", skipMessage);
        }
        
        const cid = j.applied?.curso_id || cursosList.find((c: any) => c.curriculum_key === k)?.id;
        if (cid) {
          applied[k] = {
            cursoId: cid,
            classes,
            version: j.applied?.version ?? null,
          };
        }
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
    if (!anoLetivoId) return error("Sem ano letivo.");
    if (!escolaContextId) return error("Escola ainda não resolvida.");
    const tid = toast({ variant: "syncing", title: "Gerando turmas...", duration: 0 });
    try {
      const slotsRes = await fetch(`/api/escolas/${escolaContextId}/horarios/slots`, { cache: "no-store" });
      const slotsJson = await slotsRes.json().catch(() => null);
      const slotsPayload = slotsRes.ok && slotsJson?.ok ? (slotsJson.items || []) : [];
      const selectedTurnos = (Object.keys(turnos) as Array<keyof TurnosState>)
        .filter((key) => turnos[key])
        .map((key) => mapTurnoId(key));
      const totalSlots = slotsPayload
        .filter((slot: any) => selectedTurnos.includes(slot.turno_id) && !slot.is_intervalo)
        .length;

      const cargaPorClasse = new Map<string, number>();
      const cursosAgrupados = matrix.reduce((acc, row) => {
        if (!acc[row.cursoKey]) acc[row.cursoKey] = [] as string[];
        acc[row.cursoKey].push(row.nome);
        return acc;
      }, {} as Record<string, string[]>);

      for (const [cursoKey, classes] of Object.entries(cursosAgrupados)) {
        const bp = await loadPresetBlueprint(cursoKey);
        const classSet = new Set(classes);
        const byKey = new Map<string, number>();
        bp.forEach((disciplina: any) => {
          const nome = String(disciplina?.nome ?? "").trim();
          const classe = String(disciplina?.classe ?? "").trim();
          if (!nome || !classe || !classSet.has(classe)) return;
          if (Number.isFinite(disciplina?.horas)) {
            byKey.set(`${classe}::${nome}`, Number(disciplina.horas));
          }
        });

        const overridePrefix = `${cursoKey}::`;
        Object.entries(curriculumOverrides).forEach(([key, value]) => {
          if (!key.startsWith(overridePrefix)) return;
          const remainder = key.slice(overridePrefix.length);
          const [classe, ...subjectParts] = remainder.split("::");
          const subject = subjectParts.join("::");
          if (!classe || !subject || !classSet.has(classe)) return;
          const baseKey = `${classe}::${subject}`;
          if (Number.isFinite(value)) {
            byKey.set(baseKey, Number(value));
          }
        });

        for (const [key, hours] of byKey.entries()) {
          const [classe] = key.split("::");
          const current = cargaPorClasse.get(classe) ?? 0;
          cargaPorClasse.set(classe, current + hours);
        }
      }

      const overloads = Array.from(cargaPorClasse.entries()).filter(([, carga]) => carga > totalSlots);
      if (overloads.length > 0 && totalSlots > 0) {
        warning(
          `Carga semanal acima da capacidade: ${overloads
            .map(([classe, carga]) => `${classe} (${carga}/${totalSlots})`)
            .join(", ")}. Ajuste o currículo ou o turno.`
        );
      }

      const classesDb = await fetchAllPaginated<any>(`/api/escolas/${escolaContextId}/classes`);
      const mapClasses: any = {}; // cursoId -> { nome: id }
      classesDb.forEach((c: any) => {
        if(!mapClasses[c.curso_id]) mapClasses[c.curso_id] = {};
        mapClasses[c.curso_id][c.nome] = c.id;
      });

      const grouped = matrix.reduce((acc, row) => {
        if(!acc[row.cursoKey]) acc[row.cursoKey] = [];
        acc[row.cursoKey].push(row);
        return acc;
      }, {} as any);

      for (const k of Object.keys(grouped)) {
        const info = appliedCursos[k];
        if (!info?.cursoId) continue;
        const rows = grouped[k];
        const cm = mapClasses[info.cursoId] || {};
        const payload: any[] = [];

        const resPublish = await fetch(`/api/escola/${escolaParam}/admin/curriculo/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cursoId: info.cursoId,
            anoLetivoId: anoLetivoId,
            version: info.version ?? 1,
            rebuildTurmas: false,
            confirmNoRebuildWithExistingTurmas: true,
            bulk: true,
          }),
        });
        const publishJson = await resPublish.json().catch(() => null);
        if (!resPublish.ok || publishJson?.ok === false) {
          throw new Error(publishJson?.error || publishJson?.message || "Falha ao publicar currículo.");
        }

        rows.forEach((r: any) => {
          const cid = cm[r.nome];
          if(!cid) return;
          if(r.manha) payload.push({ classeId: cid, turno: 'M', quantidade: r.manha });
          if(r.tarde) payload.push({ classeId: cid, turno: 'T', quantidade: r.tarde });
          if(r.noite) payload.push({ classeId: cid, turno: 'N', quantidade: r.noite });
        });

        if (payload.length) {
          await fetch(`/api/escola/${escolaParam}/admin/turmas/generate`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cursoId: info.cursoId, anoLetivo, turmas: payload })
          });
        }
      }
      dismiss(tid);

      // Finalizar onboarding no banco de dados
      try {
        await fetch(`/api/escolas/${escolaContextId}/onboarding/core/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "academico" })
        });
      } catch (err) {
        console.error("Erro ao finalizar onboarding:", err);
      }

      success("Configuração concluída.");
      
      setShowFinalSuccess(true);
      
      // Pequeno delay para o utilizador ver a confirmação contextual (Harmonia UX)
      setTimeout(() => {
        if (onComplete) onComplete();
        else window.location.href = `/escola/${escolaParam}/admin/dashboard`;
      }, 2000);

    } catch (e: any) {
      dismiss(tid);
      const networkIssue = resolvePublishNetworkIssue(e);
      if (networkIssue) {
        error(networkIssue.title, networkIssue.detail);
        return;
      }
      error(e.message);
    }
  };

  const handleNext = async () => {
    if (step === 1) { if (await handleCreateSession()) setStep(2); return; }
    if (step === 2) { if (await handleSavePreferences()) setStep(3); return; }
    if (step === 3) { await handleApplyCurriculumPreset(); return; }
    if (step === 4) { await handleGenerateTurmas(); }
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      
      {/* HEADER GERAL */}
      <div className="mx-auto mb-10 max-w-5xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#1F6B3B]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#1F6B3B]">
          <School className="h-3 w-3" />
          Configuração Inicial
        </div>
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          Setup do {schoolDisplayName || "Sistema"}
        </h1>
        <p className="mt-2 text-slate-500">
          Siga as etapas para definir o calendário, regras e estrutura de turmas.
        </p>
      </div>

      <WizardStepper currentStep={step} />

      {/* CARD PRINCIPAL */}
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        
        {/* Step Content */}
        <div className="p-8">
          {step === 1 && (
            <AcademicStep1
              schoolDisplayName={schoolDisplayName}
              schoolNif={schoolNif}
              schoolPlan={schoolPlan}
              setSchoolDisplayName={setSchoolDisplayName}
              anoLetivo={anoLetivo}
              setAnoLetivo={(val) => {
                markStep1Touched();
                setAnoLetivo(val);
              }}
              dataInicio={dataInicio}
              setDataInicio={(val) => {
                markStep1Touched();
                setDataInicio(val);
              }}
              dataFim={dataFim}
              setDataFim={(val) => {
                markStep1Touched();
                setDataFim(val);
              }}
              periodosConfig={periodosConfigDerived}
              onPeriodoChange={(n, f, v) => {
                markStep1Touched();
                setPeriodosConfig(prev => prev.map(p => p.numero === n ? { ...p, [f]: v } : p));
              }}
              turnos={turnos} onTurnoToggle={handleTurnoToggle}
              sessaoAtiva={sessaoAtiva} periodos={periodos}
              creatingSession={creatingSession} onCreateSession={handleCreateSession}
            />
          )}

          {step === 2 && (
            <AcademicStep2Config
              frequenciaModelo={frequenciaModelo} onFrequenciaModeloChange={setFrequenciaModelo}
              frequenciaMinPercent={frequenciaMinPercent} onFrequenciaMinPercentChange={(v) => setFrequenciaMinPercent(Math.max(0, Math.min(100, Number(v))))}
              modeloAvaliacao={modeloAvaliacao}
              onModeloAvaliacaoChange={(v) => {
                setModeloAvaliacao(v);
                const selected = modelosAvaliacao.find((modelo) => modelo.id === v);
                if (selected) {
                  setAvaliacaoConfig(cloneConfig(selected.componentes));
                }
              }}
              modelosAvaliacao={modelosAvaliacao.map((modelo) => ({ id: modelo.id, nome: modelo.nome }))}
              avaliacaoConfig={avaliacaoConfig}
            />
          )}

          {step === 3 && (
            <AcademicStep2
              escolaId={escolaContextId}
              presetCategory={presetCategory} onPresetCategoryChange={setPresetCategory}
              matrix={matrix} onMatrixChange={setMatrix} onMatrixUpdate={handleMatrixUpdate}
              turnos={turnos}
              onApplyCurriculumPreset={handleApplyCurriculumPreset} applyingPreset={applyingPreset}
              padraoNomenclatura={padraoNomenclatura} onPadraoNomenclaturaChange={setPadraoNomenclatura}
              anoLetivo={anoLetivo}
              curriculumOverrides={curriculumOverrides}
              onCurriculumOverridesChange={setCurriculumOverrides}
            />
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1F6B3B] text-white">
                  <Wand2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Tudo pronto para gerar!</h3>
                  <p className="text-sm text-slate-600">
                    O sistema irá criar as turmas, vincular disciplinas e definir os diários com base na matriz abaixo.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Classe / Curso</th>
                      <th className="px-6 py-3 font-semibold text-center">Manhã</th>
                      <th className="px-6 py-3 font-semibold text-center">Tarde</th>
                      <th className="px-6 py-3 font-semibold text-center">Noite</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matrix.map((row) => (
                      <tr key={row.id} className="bg-white">
                        <td className="px-6 py-4 font-bold text-slate-700">{row.nome}</td>
                        <td className="px-6 py-4 text-center text-slate-600">{row.manha || "-"}</td>
                        <td className="px-6 py-4 text-center text-slate-600">{row.tarde || "-"}</td>
                        <td className="px-6 py-4 text-center text-slate-600">{row.noite || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTION BAR */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-8 py-5">
          <button
            onClick={() => step > 1 && setStep(p => p - 1)}
            disabled={step === 1 || applyingPreset}
            className={`flex items-center gap-2 text-sm font-semibold transition-colors ${step === 1 ? 'cursor-not-allowed text-slate-300' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          <button
            onClick={handleNext}
            disabled={
              applyingPreset || creatingSession || loadingConfig ||
              (step === 1 && (!dataInicio || !dataFim)) ||
              (step === 3 && matrix.length === 0)
            }
            // TOKEN: Botão Dourado com Sombra
            className="inline-flex items-center gap-2 rounded-xl bg-[#E3B23C] px-8 py-3 text-sm font-bold text-white shadow-md shadow-orange-900/5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 disabled:grayscale"
          >
            {applyingPreset || creatingSession ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              step === 4 ? "Gerar Turmas e Finalizar" : "Continuar"
            )}
            {!applyingPreset && !creatingSession && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

      </div>

      {showFinalSuccess && (
        <ConfirmacaoContextual
          acaoId="matricula.confirmada.lote"
          contexto={{
            total: matrix.length,
            tempo: "2s", // Simulado
          }}
          onClose={() => {}}
        />
      )}
    </div>
  );
}
