import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type ActiveAno = {
  id: string;
  ano: number;
  ativo: boolean;
} | null;

type YearCount = {
  ano: number;
  total: number;
};

export type CutoverHealthStatus = "OK" | "WARN" | "BLOCKED";

export type CutoverHealthReport = {
  status: CutoverHealthStatus;
  can_cutover: boolean;
  escola_id: string;
  generated_at: string;
  active_year: ActiveAno;
  metrics: {
    turmas_session_id_null: number;
    matriculas_session_id_null: number;
    historico_anos_total: number;
    snapshot_locks_total: number;
    mensalidades_competencia_fora_janela: number;
    mensalidades_sem_matricula_id: number;
    curriculos_classes_pendentes: number;
    pautas_anuais_pendentes: number;
    snapshot_locks_pendentes: number;
    matriculas_status_final_pendente: number;
    turmas_by_year: YearCount[];
    matriculas_by_year: YearCount[];
    mensalidades_by_year: YearCount[];
  };
  blockers: string[];
  warnings: string[];
  technical_errors: string[];
};

function toNumericYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const m = value.match(/\d{4}/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeYearCounts(rows: Array<{ ano_letivo: unknown; total: number }>): YearCount[] {
  const map = new Map<number, number>();
  for (const row of rows) {
    const year = toNumericYear(row.ano_letivo);
    if (!year) continue;
    map.set(year, (map.get(year) ?? 0) + Number(row.total || 0));
  }
  return Array.from(map.entries())
    .map(([ano, total]) => ({ ano, total }))
    .sort((a, b) => a.ano - b.ano);
}

type QueryResult = {
  count?: number | null;
  data?: unknown;
  error?: { message?: string; code?: string; details?: string } | null;
};

type ClasseCursoRow = {
  id: string;
  curso_id: string | null;
};

type CurriculoClasseRow = {
  curso_id: string;
  classe_id: string | null;
  status: string | null;
};

type IdStatusRow = {
  id: string;
  status?: string | null;
};

type IdRow = {
  id: string;
};

type TurmaDisciplinaRow = {
  turma_id: string | null;
};

type PautaRow = {
  turma_id: string | null;
};

type SnapshotLockRow = {
  matricula_id: string | null;
  status: string | null;
};

function recordQueryError(label: string, result: QueryResult, technicalErrors: string[]) {
  if (!result.error) return;
  const message = result.error.message || "erro desconhecido";
  technicalErrors.push(`${label}: ${message}`);
}

async function countRows(
  label: string,
  query: PromiseLike<QueryResult>,
  technicalErrors: string[]
): Promise<number> {
  const result = await query;
  recordQueryError(label, result, technicalErrors);
  return result.count ?? 0;
}

async function countTableByKnownYears(
  supabase: SupabaseClient<Database>,
  table: "turmas" | "matriculas" | "mensalidades",
  escolaId: string,
  years: number[],
  technicalErrors: string[]
): Promise<YearCount[]> {
  const rows = await Promise.all(
    years.map(async (year) => {
      const value = table === "mensalidades" ? String(year) : year;
      const total = await countRows(
        `${table}.${year}`,
        supabase
          .from(table)
          .select("id", { head: true, count: "exact" })
          .eq("escola_id", escolaId)
          .eq("ano_letivo", value),
        technicalErrors
      );
      return { ano: year, total };
    })
  );

  return rows.filter((row) => row.total > 0).sort((a, b) => a.ano - b.ano);
}

async function countSpecificYear(
  supabase: SupabaseClient<Database>,
  table: "turmas" | "matriculas" | "mensalidades",
  escolaId: string,
  year: number,
  operator: "lt" | "gt" | "eq" | "neq",
  technicalErrors: string[]
): Promise<number> {
  const value = table === "mensalidades" ? String(year) : year;
  let query = supabase
    .from(table)
    .select("id", { head: true, count: "exact" })
    .eq("escola_id", escolaId);

  if (operator === "lt") query = query.lt("ano_letivo", value);
  else if (operator === "gt") query = query.gt("ano_letivo", value);
  else if (operator === "eq") query = query.eq("ano_letivo", value);
  else if (operator === "neq") query = query.neq("ano_letivo", value);

  const result = await query;
  recordQueryError(`${table}.${operator}.${year}`, result, technicalErrors);
  return result.count ?? 0;
}

export async function buildCutoverHealthReport(
  supabase: SupabaseClient<Database>,
  escolaId: string
): Promise<CutoverHealthReport> {
  const technicalErrors: string[] = [];
  const [activeAnoRes, anosLetivosRes, turmasNullRes, matriculasNullRes, historicoRes, locksRes] = await Promise.all([
    supabase
      .from("anos_letivos")
      .select("id,ano,ativo")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("anos_letivos")
      .select("id,ano,data_inicio,data_fim")
      .eq("escola_id", escolaId)
      .order("ano", { ascending: true }),
    supabase
      .from("turmas")
      .select("id", { head: true, count: "exact" })
      .eq("escola_id", escolaId)
      .is("session_id", null),
    supabase
      .from("matriculas")
      .select("id", { head: true, count: "exact" })
      .eq("escola_id", escolaId)
      .is("session_id", null),
    supabase
      .from("historico_anos")
      .select("id", { head: true, count: "exact" })
      .eq("escola_id", escolaId),
    supabase
      .from("historico_snapshot_locks")
      .select("id", { head: true, count: "exact" })
      .eq("escola_id", escolaId),
  ]);

  recordQueryError("ano letivo ativo", activeAnoRes, technicalErrors);
  recordQueryError("anos letivos", anosLetivosRes, technicalErrors);
  recordQueryError("turmas sem session_id", turmasNullRes, technicalErrors);
  recordQueryError("matrículas sem session_id", matriculasNullRes, technicalErrors);
  recordQueryError("histórico anual", historicoRes, technicalErrors);
  recordQueryError("snapshot locks", locksRes, technicalErrors);

  const activeYearRow = activeAnoRes.data
    ? { id: String(activeAnoRes.data.id), ano: Number(activeAnoRes.data.ano), ativo: Boolean(activeAnoRes.data.ativo) }
    : null;

  const knownYears = normalizeYearCounts(
    ((anosLetivosRes.data ?? []) as Array<{ ano: unknown }>).map((row) => ({ ano_letivo: row.ano, total: 0 }))
  ).map((row) => row.ano);

  const [turmasByYear, matriculasByYear, mensalidadesByYear] = await Promise.all([
    countTableByKnownYears(supabase, "turmas", escolaId, knownYears, technicalErrors),
    countTableByKnownYears(supabase, "matriculas", escolaId, knownYears, technicalErrors),
    countTableByKnownYears(supabase, "mensalidades", escolaId, knownYears, technicalErrors),
  ]);

  let mensalidadesCompetenciaForaJanela = 0;
  let mensalidadesSemMatriculaId = 0;
  let curriculosClassesPendentes = 0;
  let pautasAnuaisPendentes = 0;
  let snapshotLocksPendentes = 0;
  let matriculasStatusFinalPendente = 0;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!activeYearRow) {
    blockers.push("Nenhum ano letivo ativo encontrado.");
  }

  const turmasSessionNull = turmasNullRes.count ?? 0;
  const matriculasSessionNull = matriculasNullRes.count ?? 0;

  if (turmasSessionNull > 0) {
    blockers.push(`${turmasSessionNull} turma(s) sem session_id.`);
  }
  if (matriculasSessionNull > 0) {
    blockers.push(`${matriculasSessionNull} matrícula(s) sem session_id.`);
  }

  if (activeYearRow) {
    const activeYear = activeYearRow.ano;
    const activeAnoDetail = (anosLetivosRes.data ?? []).find((row) => row.id === activeYearRow.id);
    const rawDataInicio = (activeAnoDetail as { data_inicio?: string } | undefined)?.data_inicio;
    const rawDataFim = (activeAnoDetail as { data_fim?: string } | undefined)?.data_fim;

    const [classesRes, curriculosRes, turmasAtivasRes, matriculasAtivasRes, periodosAtivosRes] = await Promise.all([
      supabase
        .from("classes")
        .select("id,curso_id")
        .eq("escola_id", escolaId),
      supabase
        .from("curso_curriculos")
        .select("curso_id,classe_id,status")
        .eq("escola_id", escolaId)
        .eq("ano_letivo_id", activeYearRow.id),
      supabase
        .from("turmas")
        .select("id,status_validacao")
        .eq("escola_id", escolaId)
        .eq("session_id", activeYearRow.id),
      supabase
        .from("matriculas")
        .select("id,status")
        .eq("escola_id", escolaId)
        .eq("session_id", activeYearRow.id),
      supabase
        .from("periodos_letivos")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("ano_letivo_id", activeYearRow.id),
    ]);

    recordQueryError("classes para currículo", classesRes, technicalErrors);
    recordQueryError("currículos publicados por classe", curriculosRes, technicalErrors);
    recordQueryError("turmas ativas por sessão", turmasAtivasRes, technicalErrors);
    recordQueryError("matrículas ativas por sessão", matriculasAtivasRes, technicalErrors);
    recordQueryError("períodos letivos da sessão ativa", periodosAtivosRes, technicalErrors);

    const classesRows = (classesRes.data ?? []) as ClasseCursoRow[];
    const curriculoRows = (curriculosRes.data ?? []) as CurriculoClasseRow[];
    const turmasAtivas = (turmasAtivasRes.data ?? []) as IdStatusRow[];
    const matriculasAtivas = (matriculasAtivasRes.data ?? []) as IdStatusRow[];
    const periodoIds = ((periodosAtivosRes.data ?? []) as IdRow[]).map((row) => row.id);

    if (periodoIds.length === 0) {
      blockers.push("Ano letivo ativo sem períodos letivos configurados.");
    }

    const publishedByCurso = new Map<string, Set<string>>();
    for (const row of curriculoRows) {
      if (row.status !== "published" || !row.classe_id) continue;
      const set = publishedByCurso.get(row.curso_id) ?? new Set<string>();
      set.add(row.classe_id);
      publishedByCurso.set(row.curso_id, set);
    }

    curriculosClassesPendentes = classesRows.filter((row) => {
      if (!row.curso_id) return false;
      return !(publishedByCurso.get(row.curso_id) ?? new Set<string>()).has(row.id);
    }).length;

    const turmaIds = turmasAtivas.map((row) => row.id).filter(Boolean);
    if (turmaIds.length > 0) {
      const [pautasRes, turmaDisciplinasRes] = await Promise.all([
        supabase
          .from("pautas_oficiais")
          .select("turma_id")
          .eq("escola_id", escolaId)
          .eq("tipo", "anual")
          .eq("status", "SUCCESS")
          .in("turma_id", turmaIds)
          .in("periodo_letivo_id", periodoIds.length > 0 ? periodoIds : [activeYearRow.id]),
        supabase
          .from("turma_disciplinas")
          .select("turma_id")
          .eq("escola_id", escolaId)
          .in("turma_id", turmaIds),
      ]);

      recordQueryError("pautas anuais oficiais", pautasRes, technicalErrors);
      recordQueryError("turma_disciplinas da sessão ativa", turmaDisciplinasRes, technicalErrors);

      const pautaSet = new Set(((pautasRes.data ?? []) as PautaRow[]).map((row) => row.turma_id).filter(Boolean));
      const turmaDisciplinaSet = new Set(((turmaDisciplinasRes.data ?? []) as TurmaDisciplinaRow[]).map((row) => row.turma_id).filter(Boolean));
      pautasAnuaisPendentes = turmaIds.filter((id) => !pautaSet.has(id)).length;

      const turmasSemDisciplinas = turmaIds.filter((id) => !turmaDisciplinaSet.has(id)).length;
      if (turmasSemDisciplinas > 0) {
        blockers.push(`Turmas sem disciplinas vinculadas na sessão ativa: ${turmasSemDisciplinas}.`);
      }
    }

    const matriculaIds = matriculasAtivas.map((row) => row.id).filter(Boolean);
    matriculasStatusFinalPendente = matriculasAtivas.filter((row) => {
      const status = String(row.status ?? "").toLowerCase();
      return !["concluido", "reprovado", "reprovada", "reprovado_por_faltas", "transferido", "inativo", "desistente", "trancado"].includes(status);
    }).length;

    if (matriculaIds.length > 0) {
      const locksAtivosRes = await supabase
        .from("historico_snapshot_locks")
        .select("matricula_id,status")
        .eq("escola_id", escolaId)
        .eq("ano_letivo_id", activeYearRow.id)
        .in("matricula_id", matriculaIds);

      recordQueryError("snapshot locks por matrícula ativa", locksAtivosRes, technicalErrors);

      const closedLocks = new Set(
        ((locksAtivosRes.data ?? []) as SnapshotLockRow[])
          .filter((row) => row.status === "fechado" && row.matricula_id)
          .map((row) => row.matricula_id as string)
      );
      snapshotLocksPendentes = matriculaIds.filter((id) => !closedLocks.has(id)).length;
    }

    // Split check between Past and Future data
    const tables: Array<"turmas" | "matriculas" | "mensalidades"> = ["turmas", "matriculas", "mensalidades"];
    
    for (const table of tables) {
        const past = await countSpecificYear(supabase, table, escolaId, activeYear, "lt", technicalErrors);
        const future = await countSpecificYear(supabase, table, escolaId, activeYear, "gt", technicalErrors);
        const nulls = await countRows(`${table}.null`, supabase.from(table).select("id", {head: true, count: 'exact'}).eq("escola_id", escolaId).is("ano_letivo", null), technicalErrors);

        if (past > 0) {
            blockers.push(`Detectados registros de anos PASSADOS vinculados à escola (${table}: ${past}). Realize o arquivamento primeiro.`);
        }
        if (nulls > 0) {
            blockers.push(`Detectados registros com ano_letivo NULO (${table}: ${nulls}).`);
        }
        if (future > 0) {
            warnings.push(`Detectados registros de anos FUTUROS (${table}: ${future}). Isto é normal se estiver a preparar a virada.`);
        }
    }

    mensalidadesSemMatriculaId = await countRows(
      "mensalidades.sem_matricula_id",
      supabase
        .from("mensalidades")
        .select("id", { head: true, count: "exact" })
        .eq("escola_id", escolaId)
        .is("matricula_id", null),
      technicalErrors
    );

    if (rawDataInicio && rawDataFim) {
      const { data: mensalidadesRaw, error: mensalidadesError } = await supabase
        .from("mensalidades")
        .select("id,ano_referencia,mes_referencia")
        .eq("escola_id", escolaId);

      if (mensalidadesError) {
        technicalErrors.push(`mensalidades.competencia_janela: ${mensalidadesError.message}`);
      } else {
        const start = new Date(`${rawDataInicio}T00:00:00.000Z`);
        const end = new Date(`${rawDataFim}T23:59:59.999Z`);
        const startMs = start.getTime();
        const endMs = end.getTime();

        mensalidadesCompetenciaForaJanela = (mensalidadesRaw ?? []).reduce((acc, row) => {
          const year = Number(row.ano_referencia);
          const month = Number(row.mes_referencia);
          if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return acc + 1;
          const ref = new Date(Date.UTC(year, month - 1, 1));
          const inside = ref.getTime() >= startMs && ref.getTime() <= endMs;
          return inside ? acc : acc + 1;
        }, 0);
      }
    }

    if (mensalidadesCompetenciaForaJanela > 0) {
      blockers.push(
        `Mensalidades fora da janela do ano letivo ativo: ${mensalidadesCompetenciaForaJanela}.`
      );
    }

    if (mensalidadesSemMatriculaId > 0) {
      blockers.push(
        `Mensalidades sem matrícula vinculada: ${mensalidadesSemMatriculaId}.`
      );
    }

    if (curriculosClassesPendentes > 0) {
      blockers.push(`Classes sem currículo publicado no ano ativo: ${curriculosClassesPendentes}.`);
    }

    if (pautasAnuaisPendentes > 0) {
      blockers.push(`Turmas sem pauta anual oficial gerada: ${pautasAnuaisPendentes}.`);
    }

    if (matriculasStatusFinalPendente > 0) {
      blockers.push(`Matrículas ainda sem estado final para promoção: ${matriculasStatusFinalPendente}.`);
    }

    if (snapshotLocksPendentes > 0) {
      blockers.push(`Matrículas sem snapshot histórico fechado: ${snapshotLocksPendentes}.`);
    }
  }

  const historicoTotal = historicoRes.count ?? 0;
  const locksTotal = locksRes.count ?? 0;

  if (historicoTotal === 0) {
    warnings.push("Sem registros em historico_anos.");
  }
  if (locksTotal === 0) {
    warnings.push("Sem registros em historico_snapshot_locks.");
  }

  if (technicalErrors.length > 0) {
    const sample = technicalErrors.slice(0, 3).join(" | ");
    blockers.unshift(`Falha técnica ao calcular saúde da virada: ${technicalErrors.length} consulta(s) com erro. ${sample}`);
  }

  const status: CutoverHealthStatus = blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "WARN" : "OK";

  return {
    status,
    can_cutover: status !== "BLOCKED",
    escola_id: escolaId,
    generated_at: new Date().toISOString(),
    active_year: activeYearRow,
    metrics: {
      turmas_session_id_null: turmasSessionNull,
      matriculas_session_id_null: matriculasSessionNull,
      historico_anos_total: historicoTotal,
      snapshot_locks_total: locksTotal,
      mensalidades_competencia_fora_janela: mensalidadesCompetenciaForaJanela,
      mensalidades_sem_matricula_id: mensalidadesSemMatriculaId,
      curriculos_classes_pendentes: curriculosClassesPendentes,
      pautas_anuais_pendentes: pautasAnuaisPendentes,
      snapshot_locks_pendentes: snapshotLocksPendentes,
      matriculas_status_final_pendente: matriculasStatusFinalPendente,
      turmas_by_year: turmasByYear,
      matriculas_by_year: matriculasByYear,
      mensalidades_by_year: mensalidadesByYear,
    },
    blockers,
    warnings,
    technical_errors: technicalErrors,
  };
}
