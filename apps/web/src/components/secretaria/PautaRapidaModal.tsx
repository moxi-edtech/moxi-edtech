"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid";
import { formatTurmaDisplayName, formatTurnoDisplay } from "@/utils/formatters";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";

type TurmaItem = {
  id: string;
  turma_nome?: string | null;
  nome?: string | null;
  turno?: string | null;
  classe_nome?: string | null;
};

type DisciplinaItem = {
  id: string;
  disciplina?: { id?: string | null; nome?: string | null } | null;
  meta?: {
    carga_horaria_semanal?: number | null;
    classificacao?: string | null;
    periodos_ativos?: number[] | null;
    entra_no_horario?: boolean | null;
    avaliacao_mode?: string | null;
  } | null;
  curriculo_status?: string | null;
};

type PeriodoItem = {
  id: string;
  numero: number;
  dt_inicio?: string | null;
  dt_fim?: string | null;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type PautaRapidaModalProps = {
  initialTurmaId?: string;
  initialPeriodoNumero?: number;
  initialDisciplinaId?: string;
  initialTurmaLabel?: string;
  lockTurma?: boolean;
  showPeriodoTabs?: boolean;
  pendingPeriodoNumeros?: number[];
  focusAlunoId?: string;
  hideNavigation?: boolean;
};

export function PautaRapidaModal({
  initialTurmaId,
  initialPeriodoNumero,
  initialDisciplinaId,
  initialTurmaLabel,
  lockTurma = false,
  showPeriodoTabs = false,
  pendingPeriodoNumeros = [],
  focusAlunoId,
  hideNavigation = false,
}: PautaRapidaModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAcademicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM) ?? null;
  const [academicYearId, setAcademicYearId] = useState<string | null>(requestedAcademicYearId);
  const [academicMode, setAcademicMode] = useState<"CURRENT" | "HISTORICAL_READ" | null>(null);
  const [academicContextError, setAcademicContextError] = useState<string | null>(null);
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear());
  const [turmas, setTurmas] = useState<TurmaItem[]>([]);
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoItem[]>([]);
  const [periodoNumero, setPeriodoNumero] = useState<number>(1);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [loadingDisciplinas, setLoadingDisciplinas] = useState(false);
  const [pautaInitial, setPautaInitial] = useState<StudentGradeRow[]>([]);
  const [pautaDraft, setPautaDraft] = useState<StudentGradeRow[]>([]);
  const [pautaPesoPorTipo, setPautaPesoPorTipo] = useState<Record<string, number> | null>(null);
  const [pautaComponentes, setPautaComponentes] = useState<string[]>([]);
  const [pautaNotaMaxima, setPautaNotaMaxima] = useState<number | null>(20);
  const [pautaNotaCorte, setPautaNotaCorte] = useState<number | null>(10);
  const [pautaEscala, setPautaEscala] = useState<string | null>(null);
  const [loadingPauta, setLoadingPauta] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
  }, []);

  useEffect(() => {
    let active = true;
    setAcademicYearId(null);
    setAcademicMode(null);
    setAcademicContextError(null);

    const query = requestedAcademicYearId
      ? `?${ACADEMIC_YEAR_PARAM}=${encodeURIComponent(requestedAcademicYearId)}`
      : "";

    void fetch(`/api/academic-context${query}`, { cache: "no-store" })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!active) return;
        const resolvedId = payload?.context?.anoLetivoId;
        if (!response.ok || !payload?.ok || typeof resolvedId !== "string") {
          setAcademicYearId(null);
          setAcademicMode(null);
          setAcademicContextError(payload?.error || "Não foi possível identificar o ano letivo.");
          return;
        }
        setAcademicYearId(resolvedId);
        setAcademicMode(payload.context?.mode === "CURRENT" ? "CURRENT" : "HISTORICAL_READ");
      })
      .catch(() => {
        if (!active) return;
        setAcademicYearId(null);
        setAcademicMode(null);
        setAcademicContextError("Não foi possível identificar o ano letivo.");
      });

    return () => {
      active = false;
    };
  }, [requestedAcademicYearId]);

  useEffect(() => {
    if (lockTurma) {
      setTurmaId(initialTurmaId ?? "");
      setDisciplinaId("");
      setPautaInitial([]);
      setPautaDraft([]);
      setSaveError(null);
      return;
    }

    if (initialTurmaId) {
      setTurmaId(initialTurmaId);
      setDisciplinaId("");
    }
  }, [initialTurmaId, lockTurma]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (lockTurma) return;
      setLoadingTurmas(true);
      try {
        const params = new URLSearchParams({ ano: String(anoLetivo) });
        const res = await fetch(`/api/secretaria/turmas-simples?${params.toString()}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          setTurmas(json.items || json.data || []);
        } else {
          setTurmas([]);
        }
      } finally {
        if (active) setLoadingTurmas(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [accessToken, anoLetivo, lockTurma]);

  useEffect(() => {
    if (!turmaId) {
      setDisciplinas([]);
      setDisciplinaId("");
      return;
    }

    let active = true;
    const load = async () => {
      setLoadingDisciplinas(true);
      try {
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/disciplinas`, {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok) {
          setDisciplinas(json.items || []);
          setPeriodos(json.periodos || []);
          const firstNumero = json.periodos?.[0]?.numero;
          if (typeof firstNumero === "number") {
            setPeriodoNumero(firstNumero);
          }
        } else {
          setDisciplinas([]);
          setPeriodos([]);
        }
      } finally {
        if (active) setLoadingDisciplinas(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [accessToken, turmaId]);

  useEffect(() => {
    if (typeof initialPeriodoNumero !== "number") return;
    if (!periodos.length) return;
    const target = periodos.find((p) => p.numero === initialPeriodoNumero);
    if (target) setPeriodoNumero(target.numero);
  }, [initialPeriodoNumero, periodos]);

  const selectedTurmaDisciplinaId = useMemo(
    () => disciplinas.find((disciplina) => disciplina.disciplina?.id === disciplinaId)?.id ?? null,
    [disciplinas, disciplinaId],
  )

  useEffect(() => {
    if (!academicYearId || !turmaId || !disciplinaId || !periodoNumero || !selectedTurmaDisciplinaId) {
      setPautaInitial([]);
      setPautaDraft([]);
      setPautaPesoPorTipo(null);
      setPautaComponentes([]);
      setPautaNotaMaxima(20);
      setPautaNotaCorte(10);
      setPautaEscala(null);
      return;
    }

    let active = true;
    const load = async () => {
      setLoadingPauta(true);
      try {
        const params = new URLSearchParams({
          disciplinaId,
          trimestre: String(periodoNumero),
          anoLetivoId: academicYearId,
          turmaDisciplinaId: selectedTurmaDisciplinaId,
        });
        if (focusAlunoId) params.set("alunoId", focusAlunoId);
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/pauta-grid?${params.toString()}`, {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && json.ok && Array.isArray(json.items)) {
          const mapped: StudentGradeRow[] =
            json.items.map((row: any, index: number) => ({
              id: row.aluno_id,
              numero: row.numero_chamada ?? index + 1,
              nome: row.nome,
              foto: row.foto ?? null,
              mac1: row.mac ?? null,
              npp1: row.npp ?? null,
              npt1: row.npt ?? null,
              mt1: row.mt ?? null,
              is_isento: !!row.is_isento,
              _status: "synced",
            }));
          const scoped = focusAlunoId
            ? mapped.filter((row) => row.id === focusAlunoId)
            : mapped;
          setPautaInitial(scoped);
          setPautaDraft(scoped);
          setPautaPesoPorTipo((json.meta?.peso_por_tipo as Record<string, number>) ?? null);
          setPautaComponentes(Array.isArray(json.meta?.componentes_ativos) ? json.meta.componentes_ativos : []);
          setPautaNotaMaxima(typeof json.meta?.nota_maxima === "number" ? json.meta.nota_maxima : null);
          setPautaNotaCorte(typeof json.meta?.nota_corte === "number" ? json.meta.nota_corte : null);
          setPautaEscala(typeof json.meta?.escala === "string" ? json.meta.escala : null);
        } else {
          setPautaInitial([]);
          setPautaDraft([]);
          setPautaPesoPorTipo(null);
          setPautaComponentes([]);
        }
      } finally {
        if (active) setLoadingPauta(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [academicYearId, accessToken, turmaId, disciplinaId, periodoNumero, focusAlunoId, selectedTurmaDisciplinaId]);

  const disciplinasFiltradas = useMemo(() => {
    return disciplinas.filter((disciplina) => {
      const periodosAtivos = disciplina.meta?.periodos_ativos;
      if (!periodosAtivos || periodosAtivos.length === 0) return true;
      return periodosAtivos.includes(periodoNumero);
    });
  }, [disciplinas, periodoNumero]);

  useEffect(() => {
    if (!initialDisciplinaId) return;
    if (disciplinaId) return;
    const exists = disciplinasFiltradas.some((disc) => disc.disciplina?.id === initialDisciplinaId);
    if (exists) {
      setDisciplinaId(initialDisciplinaId);
    }
  }, [disciplinaId, disciplinasFiltradas, initialDisciplinaId]);

  const turmaSelecionada = useMemo(
    () => turmas.find((t) => t.id === turmaId) ?? null,
    [turmas, turmaId]
  );

  const disciplinaSelecionada = useMemo(
    () => disciplinasFiltradas.find((d) => d.disciplina?.id === disciplinaId) ?? null,
    [disciplinasFiltradas, disciplinaId]
  );

  useEffect(() => {
    if (!disciplinaId) return;
    const stillValid = disciplinasFiltradas.some((disc) => disc.disciplina?.id === disciplinaId);
    if (!stillValid) setDisciplinaId("");
  }, [disciplinaId, disciplinasFiltradas]);

  const turmaLabel =
    initialTurmaLabel ||
    (turmaSelecionada ? formatTurmaDisplayName(turmaSelecionada) : "Turma");

  const handleSaveBatch = async (rows: StudentGradeRow[]) => {
    setSaveError(null);
    if (!turmaId || !disciplinaId) return;
    if (!academicYearId) {
      throw new Error(academicContextError || "Ano letivo ativo não identificado.");
    }
    if (academicMode !== "CURRENT") {
      throw new Error("Este ano letivo está disponível apenas para consulta.");
    }
    const turmaDisciplinaId = disciplinaSelecionada?.id ?? null;
    const disciplinaCanonicalId = disciplinaSelecionada?.disciplina?.id ?? disciplinaId;
    if (!turmaDisciplinaId) {
      throw new Error("Disciplina inválida para lançamento.");
    }

    const configured = new Set(pautaComponentes.map((tipo) => tipo.toUpperCase()));
    const allEntries = [
      { tipo: "MAC", campo: "mac1" as const },
      { tipo: "NPP", campo: "npp1" as const },
      { tipo: "NPT", campo: "npt1" as const },
    ];
    const entries = configured.size === 0
      ? allEntries.filter((entry) => entry.tipo !== "NPP")
      : allEntries.filter(
          (entry) =>
            configured.has(entry.tipo) ||
            (entry.tipo === "NPT" && configured.has("PT")),
        );

    const postNotas = async (params: {
      tipo: string;
      isIsento: boolean;
      notas: Array<{ aluno_id: string; valor: number | null }>;
    }) => {
      if (params.notas.length === 0) return;

      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const response = await fetch("/api/secretaria/notas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          turma_id: turmaId,
          ano_letivo_id: academicYearId,
          disciplina_id: disciplinaCanonicalId,
          turma_disciplina_id: turmaDisciplinaId,
          trimestre: periodoNumero,
          tipo_avaliacao: params.tipo,
          is_isento: params.isIsento,
          notas: params.notas,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Falha ao guardar notas.");
      }
    };

    const isentos = rows.filter((row) => row.is_isento);
    for (const { tipo } of entries) {
      await postNotas({
        tipo,
        isIsento: true,
        notas: isentos.map((row) => ({ aluno_id: row.id, valor: null })),
      });
    }

    const activeRows = rows.filter((row) => !row.is_isento);
    for (const { tipo, campo } of entries) {
      await postNotas({
        tipo,
        isIsento: false,
        notas: activeRows.map((row) => ({
          aluno_id: row.id,
          valor: row[campo] ?? null,
        })),
      });
    }

    setPautaDraft((prev) =>
      prev.map((row) => {
        const updated = rows.find((candidate) => candidate.id === row.id);
        return updated ? { ...row, ...updated, _status: "synced" } : row;
      })
    );
  };

  return (
    <div className="space-y-4">
      {academicContextError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {academicContextError}
        </div>
      ) : null}

      {academicMode === "HISTORICAL_READ" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ano letivo em consulta histórica. As notas podem ser consultadas, mas não alteradas.
        </div>
      ) : null}

      {pautaEscala && pautaNotaMaxima === null ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta turma usa uma escala não numérica. O lançamento quantitativo está indisponível neste painel.
        </div>
      ) : null}

      {focusAlunoId ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Lançamento individual</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Escolha a disciplina e o período. Apenas o aluno atual será alterado.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {!lockTurma && (
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Ano letivo</label>
            <input
              type="number"
              value={anoLetivo}
              onChange={(event) => setAnoLetivo(Number(event.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Turma</label>
          {lockTurma ? (
            <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {turmaLabel}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <select
                value={turmaId}
                onChange={(event) => setTurmaId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              >
                <option value="">Selecione a turma</option>
                {turmas.map((turma) => {
                  const label = formatTurmaDisplayName(turma);
                  const meta = [turma.classe_nome, formatTurnoDisplay(turma.turno)].filter(Boolean).join(" • ");
                  return (
                    <option key={turma.id} value={turma.id}>
                      {meta ? `${label} (${meta})` : label}
                    </option>
                  );
                })}
              </select>
              {loadingTurmas ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-slate-500">Disciplina</label>
        <div className="mt-1 flex items-center gap-2">
          <select
            value={disciplinaId}
            onChange={(event) => setDisciplinaId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
            disabled={!turmaId}
          >
            <option value="">Selecione a disciplina</option>
            {disciplinasFiltradas.map((disciplina) => (
              <option key={disciplina.id} value={disciplina.disciplina?.id ?? ""}>
                {disciplina.disciplina?.nome ?? "Disciplina"}
              </option>
            ))}
          </select>
          {loadingDisciplinas ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-slate-500">Período</label>
        {showPeriodoTabs && periodos.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {periodos.map((periodo) => {
              const active = periodo.numero === periodoNumero
              const hasPendencia = pendingPeriodoNumeros.includes(periodo.numero)
              return (
                <button
                  key={periodo.id}
                  type="button"
                  onClick={() => setPeriodoNumero(periodo.numero)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-emerald text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {`Trimestre ${periodo.numero}`}
                    {hasPendencia ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-rose-500"}`} />
                    ) : null}
                  </span>
                </button>
              )
            })}
            {loadingDisciplinas ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <select
              value={periodoNumero}
              onChange={(event) => setPeriodoNumero(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              disabled={!turmaId || periodos.length === 0}
            >
              {periodos.length === 0 && (
                <option value={periodoNumero}>Sem períodos</option>
              )}
              {periodos.map((periodo) => (
                <option key={periodo.id} value={periodo.numero}>
                  {`Período ${periodo.numero}`}
                </option>
              ))}
            </select>
            {loadingDisciplinas ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
        )}
      </div>

      {disciplinaSelecionada ? (
        <p className="text-xs text-slate-500">
          Disciplina selecionada: {disciplinaSelecionada.disciplina?.nome ?? "—"}
        </p>
      ) : null}

      {lockTurma && !turmaId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Este aluno não tem uma turma disponível no contexto académico atual. Não é possível lançar nota.
        </div>
      ) : loadingPauta ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Carregando pauta...
        </div>
      ) : pautaInitial.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          {focusAlunoId && turmaId && disciplinaId
            ? "O aluno não aparece na pauta desta turma para a disciplina e período selecionados."
            : "Selecione turma, disciplina e período para visualizar a pauta."}
        </div>
      ) : (
        <div className="space-y-3">
          <GradeEntryGrid
            initialData={pautaInitial}
            title={focusAlunoId ? "Nota do aluno" : "Lançamento de Notas"}
            subtitle={`${disciplinaSelecionada?.disciplina?.nome ?? "Disciplina"} • Trimestre ${periodoNumero}`}
            onSave={handleSaveBatch}
            onSaveError={(error) => {
              setSaveError(error instanceof Error ? error.message : "Não foi possível guardar a nota.");
            }}
            onDataChange={setPautaDraft}
            pesoPorTipo={pautaPesoPorTipo ?? undefined}
            componentesAtivos={pautaComponentes}
            showIsento={true}
            studentMode={Boolean(focusAlunoId)}
            readOnly={academicMode !== "CURRENT" || pautaNotaMaxima === null}
            notaMaxima={pautaNotaMaxima ?? 20}
            notaCorte={pautaNotaCorte ?? 10}
          />
          {saveError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {saveError}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
