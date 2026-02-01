"use client";

import { useState, useEffect, useMemo } from "react";
import { StepHeader } from "@/components/onboarding/StepHeader";
import { StepFooter } from "@/components/onboarding/StepFooter";
import { toast } from "sonner";
import { CURRICULUM_PRESETS } from "@/lib/onboarding/curriculum-presets";
import { createClient } from "@/lib/supabaseClient";

import AcademicStep1 from "./AcademicStep1";
import AcademicStep2 from "./AcademicStep2";
import AcademicStep2Config from "./AcademicStep2Config";

import { type CurriculumCategory } from "./academicSetupTypes";

import {
  type TurnosState,
  type AcademicSession,
  type Periodo,
  type MatrixRow,
  type PadraoNomenclatura,
} from "./academicSetupTypes";

type Props = {
  escolaId: string;
  onComplete?: () => void;
  initialSchoolName?: string;
};

async function fetchAllPaginated<T>(endpoint: string, limit = 50): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(endpoint, window.location.origin);
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.ok === false) {
      throw new Error(json?.error || "Falha ao carregar dados paginados");
    }
    const pageItems = (json?.data ?? json?.items ?? []) as T[];
    items.push(...pageItems);
    cursor = json?.next_cursor ?? null;
  } while (cursor);

  return items;
}

const DEFAULT_AVALIACAO_CONFIG = {
  SIMPLIFICADO: {
    componentes: [
      { code: 'MAC', peso: 50, ativo: true },
      { code: 'PT', peso: 50, ativo: true },
    ],
  },
  ANGOLANO_TRADICIONAL: {
    componentes: [
      { code: 'MAC', peso: 30, ativo: true },
      { code: 'NPP', peso: 30, ativo: true },
      { code: 'PT', peso: 40, ativo: true },
    ],
  },
  COMPETENCIAS: {
    componentes: [
      { code: 'COMP', peso: 100, ativo: true },
    ],
  },
  DEPOIS: {
    componentes: [],
  },
} as const;

const hasComponentes = (config?: { componentes?: { code: string }[] }) => (
  Array.isArray(config?.componentes) && config.componentes.length > 0
);

const cloneConfig = (config?: { componentes?: ReadonlyArray<{ code: string; peso: number; ativo: boolean }> }) => ({
  componentes: config?.componentes ? config.componentes.map((item) => ({ ...item })) : undefined,
});

export default function AcademicSetupWizard({ escolaId, onComplete, initialSchoolName }: Props) {
  const [step, setStep] = useState(1);

  // STEP 1
  const [schoolDisplayName, setSchoolDisplayName] = useState<string>(initialSchoolName || "");
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear());
  const [anoLetivoId, setAnoLetivoId] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [dataFim, setDataFim] = useState<string>(`${new Date().getFullYear()}-12-31`);
  const [periodosConfig, setPeriodosConfig] = useState([
    { numero: 1, data_inicio: `${new Date().getFullYear()}-01-01`, data_fim: `${new Date().getFullYear()}-04-30`, trava_notas_em: "" },
    { numero: 2, data_inicio: `${new Date().getFullYear()}-05-01`, data_fim: `${new Date().getFullYear()}-08-31`, trava_notas_em: "" },
    { numero: 3, data_inicio: `${new Date().getFullYear()}-09-01`, data_fim: `${new Date().getFullYear()}-12-31`, trava_notas_em: "" },
  ]);
  const [turnos, setTurnos] = useState<TurnosState>({
    "Manhã": true,
    "Tarde": true,
    "Noite": false,
  });

  const [sessaoAtiva, setSessaoAtiva] = useState<AcademicSession | null>(null);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [creatingSession, setCreatingSession] = useState(false);

  // STEP 2
  const [frequenciaModelo, setFrequenciaModelo] = useState<'POR_AULA' | 'POR_PERIODO'>('POR_AULA');
  const [frequenciaMinPercent, setFrequenciaMinPercent] = useState<number>(75);
  const [modeloAvaliacao, setModeloAvaliacao] = useState<'SIMPLIFICADO' | 'ANGOLANO_TRADICIONAL' | 'COMPETENCIAS' | 'DEPOIS'>('SIMPLIFICADO');
  const [avaliacaoConfig, setAvaliacaoConfig] = useState<{ componentes?: { code: string; peso: number; ativo: boolean }[] }>({
    componentes: [
      { code: 'MAC', peso: 50, ativo: true },
      { code: 'PT', peso: 50, ativo: true },
    ],
  });
  const [loadingConfig, setLoadingConfig] = useState(false);

  const [presetCategory, setPresetCategory] = useState<CurriculumCategory>("geral");
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [padraoNomenclatura, setPadraoNomenclatura] = useState<PadraoNomenclatura>('descritivo_completo');
  const [appliedCursos, setAppliedCursos] = useState<Record<string, { cursoId: string; classes: string[] }>>({});
  const [estruturaCounts, setEstruturaCounts] = useState<{
    cursos_total?: number;
    classes_total?: number;
    disciplinas_total?: number;
  } | null>(null);

  useEffect(() => {
    if (initialSchoolName) {
      setSchoolDisplayName((prev) => prev || initialSchoolName);
    }
  }, [initialSchoolName]);

  const supabase = useMemo(() => createClient(), []);


  const buildDefaultPeriodos = (ano: number) => ([
    { numero: 1, data_inicio: `${ano}-01-01`, data_fim: `${ano}-04-30`, trava_notas_em: "" },
    { numero: 2, data_inicio: `${ano}-05-01`, data_fim: `${ano}-08-31`, trava_notas_em: "" },
    { numero: 3, data_inicio: `${ano}-09-01`, data_fim: `${ano}-12-31`, trava_notas_em: "" },
  ]);

  useEffect(() => {
    setDataInicio(`${anoLetivo}-01-01`);
    setDataFim(`${anoLetivo}-12-31`);
    setPeriodosConfig(buildDefaultPeriodos(anoLetivo));
  }, [anoLetivo]);

  // Carrega ano letivo ativo + períodos existentes
  useEffect(() => {
    let cancelled = false;
    async function fetchSession() {
      try {
        const { data: ano } = await supabase
          .from('anos_letivos')
          .select('id, ano, data_inicio, data_fim, ativo')
          .eq('escola_id', escolaId)
          .eq('ativo', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled && ano) {
          setAnoLetivo(ano.ano);
          setAnoLetivoId(ano.id);
          setDataInicio(ano.data_inicio);
          setDataFim(ano.data_fim);
          setSessaoAtiva({
            id: ano.id,
            nome: `Ano ${ano.ano}`,
            ano_letivo: String(ano.ano),
            data_inicio: ano.data_inicio,
            data_fim: ano.data_fim,
            status: ano.ativo ? 'ativa' : 'arquivada',
          });

          const { data: periodosDb } = await supabase
            .from('periodos_letivos')
            .select('id, numero, data_inicio, data_fim, tipo, trava_notas_em')
            .eq('escola_id', escolaId)
            .eq('ano_letivo_id', ano.id)
            .order('numero', { ascending: true });

          if (!cancelled && Array.isArray(periodosDb) && periodosDb.length > 0) {
            setPeriodos(periodosDb.map((p: any) => ({
              id: p.id,
              nome: `Trimestre ${p.numero}`,
              numero: p.numero,
              data_inicio: p.data_inicio,
              data_fim: p.data_fim,
              sessao_id: ano.id,
              tipo: p.tipo,
            })));
            setPeriodosConfig(periodosDb.map((p: any) => ({
              numero: p.numero,
              data_inicio: p.data_inicio,
              data_fim: p.data_fim,
              trava_notas_em: p.trava_notas_em ? String(p.trava_notas_em).slice(0, 16) : "",
            })));
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
    if (escolaId) fetchSession();
    return () => {
      cancelled = true;
    };
  }, [escolaId]);

  // Load School Name
  useEffect(() => {
    async function fetchSchoolName() {
      try {
        const res = await fetch(`/api/escolas/${escolaId}/nome`, { cache: "no-store" });
        const json = await res.json();
        const nome = (json?.nome as string | undefined) ?? (json?.data?.nome as string | undefined);
        if (nome) {
          setSchoolDisplayName((prev) => (prev === nome ? prev : nome));
        }
      } catch (error) { console.error(error); }
    }
    if (escolaId) fetchSchoolName();
  }, [escolaId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchConfig() {
      if (!escolaId) return;
      setLoadingConfig(true);
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/configuracoes/avaliacao-frequencia`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar configurações.");
        if (cancelled) return;

        const data = json?.data ?? {};
        const modelo = data?.modelo_avaliacao || 'SIMPLIFICADO';
        setFrequenciaModelo(data?.frequencia_modelo || 'POR_AULA');
        setFrequenciaMinPercent(Number.isFinite(data?.frequencia_min_percent) ? data.frequencia_min_percent : 75);
        setModeloAvaliacao(modelo);
        setAvaliacaoConfig(
          cloneConfig(
            hasComponentes(data?.avaliacao_config)
              ? data.avaliacao_config
              : DEFAULT_AVALIACAO_CONFIG[modelo as keyof typeof DEFAULT_AVALIACAO_CONFIG]
          )
        );
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    }
    fetchConfig();
    return () => {
      cancelled = true;
    };
  }, [escolaId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchEstruturaCounts() {
      if (!escolaId) return;
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/setup/status`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) return;
        if (cancelled) return;
        const counts = json?.data?.estrutura_counts;
        if (counts) {
          setEstruturaCounts({
            cursos_total: counts.cursos_total ?? 0,
            classes_total: counts.classes_total ?? 0,
            disciplinas_total: counts.disciplinas_total ?? 0,
          });
        }
      } catch (error) {
        console.error(error);
      }
    }
    fetchEstruturaCounts();
    return () => {
      cancelled = true;
    };
  }, [escolaId]);

  // Actions
  const handleTurnoToggle = (t: keyof TurnosState) => {
    setTurnos(prev => ({ ...prev, [t]: !prev[t] }));
  };

  const handleCreateSession = async () => {
    setCreatingSession(true);
    const toastId = toast.loading("Salvando ano letivo...");
    try {
      const res = await fetch(`/api/escola/${escolaId}/admin/ano-letivo/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ano: anoLetivo,
          data_inicio: dataInicio,
          data_fim: dataFim,
          ativo: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar sessão.");
      const anoId = json?.data?.id as string | undefined;
      if (!anoId) throw new Error("Ano letivo inválido.");

      const periodosPayload = periodosConfig.map((p) => ({
        ano_letivo_id: anoId,
        tipo: 'TRIMESTRE',
        numero: p.numero,
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        trava_notas_em: p.trava_notas_em ? new Date(p.trava_notas_em).toISOString() : null,
      }));

      const resPeriodos = await fetch(`/api/escola/${escolaId}/admin/periodos-letivos/upsert-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(periodosPayload),
      });

      const jsonPeriodos = await resPeriodos.json();
      if (!resPeriodos.ok) throw new Error(jsonPeriodos.error || "Erro ao salvar períodos.");

      setAnoLetivoId(anoId);
      setSessaoAtiva({
        id: anoId,
        nome: `Ano ${anoLetivo}`,
        ano_letivo: String(anoLetivo),
        data_inicio: dataInicio,
        data_fim: dataFim,
        status: 'ativa',
      });
      setPeriodos(jsonPeriodos.data || []);
      toast.success("Ano letivo salvo.", { id: toastId });
      return true;
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
      return false;
    } finally {
      setCreatingSession(false);
    }
  };

  const handleSavePreferences = async () => {
    const toastId = toast.loading("Salvando preferências...");
    try {
      const payload = {
        frequencia_modelo: frequenciaModelo,
        frequencia_min_percent: frequenciaMinPercent,
        modelo_avaliacao: modeloAvaliacao,
        avaliacao_config: avaliacaoConfig,
      };

      const res = await fetch(`/api/escola/${escolaId}/admin/configuracoes/avaliacao-frequencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar preferências.");
      if (json?.data?.avaliacao_config) {
        setAvaliacaoConfig(cloneConfig(json.data.avaliacao_config));
      }
      toast.success("Preferências salvas.", { id: toastId });
      return true;
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
      return false;
    }
  };

  const handleMatrixUpdate = (id: string | number, field: "manha" | "tarde" | "noite", value: string) => {
    const val = parseInt(value) || 0;
    setMatrix(prev => prev.map(row => row.id === id ? { ...row, [field]: Math.max(0, val) } : row));
  };

  const handleApplyCurriculumPreset = async () => {
    // --- VALIDAÇÃO CRÍTICA ---
    if (matrix.length === 0) return toast.error("A matriz de turmas está vazia.");
    const totalTurmas = matrix.reduce((acc, r) => acc + (r.manha || 0) + (r.tarde || 0) + (r.noite || 0), 0);
    if (totalTurmas === 0) return toast.error("Defina pelo menos uma turma na matriz.");
    if (!anoLetivoId) return toast.error("Defina o ano letivo primeiro.");

    setApplyingPreset(true);
    const toastId = toast.loading("A aplicar presets... Este processo pode demorar.");

    try {
      // 1. Agrupar a matriz por curso
      const groupedByCourse = matrix.reduce((acc, row) => {
        const key = row.cursoKey;
        if (!acc[key]) {
          acc[key] = {
            cursoNome: row.cursoNome || key,
            rows: [],
          };
        }
        acc[key].rows.push(row);
        return acc;
      }, {} as Record<string, { cursoNome: string; rows: MatrixRow[] }>);

      const applied: Record<string, { cursoId: string; classes: string[] }> = {};

      const cursosList = await fetchAllPaginated<any>(`/api/escolas/${escolaId}/cursos`);
      const resolveCursoId = (cursoKey: string) => {
        const match = cursosList.find((curso: any) =>
          curso?.curriculum_key === cursoKey
          || curso?.codigo === cursoKey
          || curso?.course_code === cursoKey
        );
        return match?.id ?? null;
      };

      // 2. Iterar e chamar a API para cada curso
      for (const cursoKey in groupedByCourse) {
        const courseData = groupedByCourse[cursoKey];
        const { cursoNome, rows } = courseData;

        toast.info(`A processar curso: ${cursoNome}...`, { id: toastId });
        
        // NOVO: Extrair disciplinas do preset
        const blueprint = CURRICULUM_PRESETS[cursoKey as keyof typeof CURRICULUM_PRESETS] || [];
        
        const allSubjectsForCourse = Array.from(new Set(blueprint.map(d => d.nome)));

        const disciplinesByClass = blueprint.reduce((acc, d) => {
          if (!acc[d.classe]) {
            acc[d.classe] = [];
          }
          acc[d.classe].push(d.nome);
          return acc;
        }, {} as Record<string, string[]>);


        const classes = rows.map(r => r.nome);
        const matrixMap: Record<string, boolean> = {};
        const turnosPayload = {
          manha: turnos["Manhã"],
          tarde: turnos["Tarde"],
          noite: turnos["Noite"],
        };
        for (const row of rows) {
          const turnoCounts = { M: row.manha || 0, T: row.tarde || 0, N: row.noite || 0 };
          for (const subject of allSubjectsForCourse) {
            if (turnosPayload.manha) matrixMap[`${subject}::${row.nome}::M`] = turnoCounts.M > 0;
            if (turnosPayload.tarde) matrixMap[`${subject}::${row.nome}::T`] = turnoCounts.T > 0;
            if (turnosPayload.noite) matrixMap[`${subject}::${row.nome}::N`] = turnoCounts.N > 0;
          }
        }

        // 3. Construir o payload no formato "advancedConfig"
        const payload = {
          presetKey: cursoKey,
          ano_letivo_id: anoLetivoId,
          customData: { label: cursoNome, associatedPreset: cursoKey, classes, subjects: allSubjectsForCourse },
          advancedConfig: {
            classes,
            subjects: allSubjectsForCourse,
            matrix: matrixMap,
            turnos: turnosPayload,
          },
          options: {
            autoPublish: true,
            generateTurmas: false,
          },
        };

        const res = await fetch(`/api/escola/${escolaId}/admin/curriculo/install-preset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(`Falha ao criar o curso '${cursoNome}': ${data?.error || 'Erro desconhecido'}`);
        }

        const cursoId = data?.applied?.curso_id
          || data?.applied?.cursoId
          || resolveCursoId(cursoKey);

        if (cursoId) {
          applied[cursoKey] = { cursoId, classes };
        }
      }

      setAppliedCursos(applied);
      toast.success("Presets aplicados com sucesso.", { id: toastId });
      setStep(4);

    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setApplyingPreset(false);
    }
  };

  const handleGenerateTurmas = async () => {
    if (!anoLetivoId) return toast.error("Defina o ano letivo primeiro.");
    if (Object.keys(appliedCursos).length === 0) {
      return toast.error("Aplique o preset antes de gerar turmas.");
    }
    const toastId = toast.loading("Gerando turmas...");
    try {
      const classesRows = await fetchAllPaginated<any>(`/api/escolas/${escolaId}/classes`);

      const classByCurso: Record<string, Record<string, string>> = {};
      classesRows.forEach((cls: any) => {
        if (!cls?.curso_id || !cls?.nome || !cls?.id) return;
        if (!classByCurso[cls.curso_id]) classByCurso[cls.curso_id] = {};
        classByCurso[cls.curso_id][cls.nome] = cls.id;
      });

      const groupedByCourse = matrix.reduce((acc, row) => {
        const key = row.cursoKey;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
      }, {} as Record<string, MatrixRow[]>);

      for (const courseKey of Object.keys(groupedByCourse)) {
        const cursoInfo = appliedCursos[courseKey];
        if (!cursoInfo?.cursoId) continue;
        const rows = groupedByCourse[courseKey];
        const classMap = classByCurso[cursoInfo.cursoId] || {};
        const turmasPayload: { classeId: string; turno: "M" | "T" | "N"; quantidade: number }[] = [];

        rows.forEach((row) => {
          const classeId = classMap[row.nome];
          if (!classeId) return;
          if (row.manha) turmasPayload.push({ classeId, turno: "M", quantidade: row.manha });
          if (row.tarde) turmasPayload.push({ classeId, turno: "T", quantidade: row.tarde });
          if (row.noite) turmasPayload.push({ classeId, turno: "N", quantidade: row.noite });
        });

        if (turmasPayload.length === 0) continue;

        const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const res = await fetch(`/api/escola/${escolaId}/admin/turmas/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            cursoId: cursoInfo.cursoId,
            anoLetivo,
            turmas: turmasPayload,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Falha ao gerar turmas.");
        }
      }

      toast.success("Turmas geradas com sucesso.", { id: toastId });
      if (onComplete) onComplete();
      else window.location.href = `/escola/${escolaId}/admin/dashboard`;
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      const ok = await handleCreateSession();
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      const ok = await handleSavePreferences();
      if (ok) setStep(3);
      return;
    }
    if (step === 3) {
      await handleApplyCurriculumPreset();
      return;
    }
    if (step === 4) {
      await handleGenerateTurmas();
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10 pb-32">
      <StepHeader step={step} totalSteps={4} />

      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          {step === 1
            ? "Ano Letivo & Períodos"
            : step === 2
            ? "Frequência & Avaliação"
            : step === 3
            ? "Presets Curriculares"
            : "Gerar Turmas"}
        </h1>
        <p className="text-slate-500 text-sm max-w-xl mx-auto">
          {step === 1
            ? "Defina o ano letivo e os trimestres."
            : step === 2
            ? "Configure frequência e modelo de avaliação."
            : step === 3
            ? "Aplique presets para o currículo."
            : "Gere turmas com base no currículo publicado."}
        </p>
        {estruturaCounts && (
          <p className="text-xs text-slate-400">
            Cursos: {estruturaCounts.cursos_total ?? 0} · Classes: {estruturaCounts.classes_total ?? 0} · Disciplinas: {estruturaCounts.disciplinas_total ?? 0}
          </p>
        )}
      </header>

      {step === 1 && (
        <AcademicStep1
          schoolDisplayName={schoolDisplayName}
          setSchoolDisplayName={setSchoolDisplayName}
          anoLetivo={anoLetivo}
          setAnoLetivo={setAnoLetivo}
          dataInicio={dataInicio}
          setDataInicio={setDataInicio}
          dataFim={dataFim}
          setDataFim={setDataFim}
          periodosConfig={periodosConfig}
          onPeriodoChange={(numero, field, value) => {
            setPeriodosConfig((prev) =>
              prev.map((p) =>
                p.numero === numero ? { ...p, [field]: value } : p
              )
            );
          }}
          turnos={turnos}
          onTurnoToggle={handleTurnoToggle}
          sessaoAtiva={sessaoAtiva}
          periodos={periodos}
          creatingSession={creatingSession}
          onCreateSession={handleCreateSession}
        />
      )}

      {step === 2 && (
        <AcademicStep2Config
          frequenciaModelo={frequenciaModelo}
          onFrequenciaModeloChange={setFrequenciaModelo}
          frequenciaMinPercent={frequenciaMinPercent}
          onFrequenciaMinPercentChange={(value) => {
            const sanitized = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
            setFrequenciaMinPercent(sanitized);
          }}
          modeloAvaliacao={modeloAvaliacao}
          onModeloAvaliacaoChange={(value) => {
            setModeloAvaliacao(value);
            setAvaliacaoConfig(cloneConfig(DEFAULT_AVALIACAO_CONFIG[value]));
          }}
          avaliacaoConfig={avaliacaoConfig}
        />
      )}

      {step === 3 && (
        <AcademicStep2
          presetCategory={presetCategory}
          onPresetCategoryChange={setPresetCategory}
          matrix={matrix}
          onMatrixChange={setMatrix}
          onMatrixUpdate={handleMatrixUpdate}
          turnos={turnos}
          onApplyCurriculumPreset={handleApplyCurriculumPreset}
          applyingPreset={applyingPreset}
          padraoNomenclatura={padraoNomenclatura}
          onPadraoNomenclaturaChange={setPadraoNomenclatura}
          anoLetivo={anoLetivo}
        />
      )}

      {step === 4 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Resumo da geração</h3>
          <p className="text-xs text-slate-500">Revise as turmas por classe e turno antes de gerar.</p>
          <div className="text-sm text-slate-700">
            {matrix.map((row) => (
              <div key={row.id} className="flex items-center gap-4">
                <span className="font-semibold">{row.nome}</span>
                <span>Manhã: {row.manha || 0}</span>
                <span>Tarde: {row.tarde || 0}</span>
                <span>Noite: {row.noite || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <StepFooter
        step={step}
        totalSteps={4}
        canProceed={
          step === 1
            ? Boolean(dataInicio && dataFim)
            : step === 2
            ? Boolean(
              frequenciaModelo &&
              modeloAvaliacao &&
              frequenciaMinPercent >= 0 &&
              frequenciaMinPercent <= 100
            )
            : step === 3
            ? matrix.length > 0
            : true
        }
        onNext={handleNext}
        onBack={() => setStep(p => Math.max(1, p-1))}
        loading={applyingPreset || creatingSession || loadingConfig}
      />
    </div>
  );
}
