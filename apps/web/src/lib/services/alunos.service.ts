import { kf2Range } from "@/lib/db/kf2";
import {
  alunoListFiltersSchema,
  type AlunoListFilters,
  type AlunoListItem,
} from "@/lib/schemas/aluno.schema";
import type { SupabaseClient } from "@supabase/supabase-js";

type ListOptions = {
  includeFinanceiro?: boolean;
  includeResumo?: boolean;
};

type ListPage = {
  limit: number;
  offset: number;
  nextOffset: number | null;
  hasMore: boolean;
  nextCursor: { created_at: string; id: string } | null;
};

type ListResult = {
  items: AlunoListItem[];
  page: ListPage;
};

type MatriculaResumo = {
  aluno_id: string;
  status: string | null;
  turma_id: string | null;
  created_at: string | null;
  turmas?:
    | {
        nome?: string | null;
        turma_codigo?: string | null;
        ano_letivo?: number | null;
        cursos?: { nome?: string | null } | { nome?: string | null }[] | null;
      }
    | {
        nome?: string | null;
        turma_codigo?: string | null;
        ano_letivo?: number | null;
        cursos?: { nome?: string | null } | { nome?: string | null }[] | null;
      }[]
    | null;
};

type MensalidadeResumo = {
  aluno_id: string;
  status: string | null;
  data_vencimento: string | null;
  valor_previsto: number | null;
  valor: number | null;
  valor_pago_total: number | null;
};

const mapStatusForRpc = (status?: string | null) => {
  if (!status) return "ativo";
  const normalized = status.toLowerCase();
  if (normalized === "active") return "ativo";
  if (normalized === "archived") return "arquivado";
  return normalized;
};

export function parseAlunoListFilters(url: URL): AlunoListFilters {
  const cursor = url.searchParams.get("cursor");
  const [cursorCreatedAt, cursorId] = cursor ? cursor.split(",") : [];
  const parsed = alunoListFiltersSchema.safeParse({
    q: url.searchParams.get("q") || url.searchParams.get("search") || undefined,
    status: url.searchParams.get("status") || undefined,
    ano: url.searchParams.get("ano") || url.searchParams.get("ano_letivo") || undefined,
    turmaId: url.searchParams.get("turma_id") || url.searchParams.get("turmaId") || undefined,
    limit: url.searchParams.get("limit") || url.searchParams.get("pageSize") || undefined,
    page: url.searchParams.get("page") || undefined,
    offset: url.searchParams.get("offset") || undefined,
    cursorCreatedAt: url.searchParams.get("cursor_created_at") || cursorCreatedAt || undefined,
    cursorId: url.searchParams.get("cursor_id") || cursorId || undefined,
    situacaoFinanceira: url.searchParams.get("situacao_financeira") || undefined,
    statusMatricula: url.searchParams.get("status_matricula") || undefined,
    includeResumo: url.searchParams.get("includeResumo") === "1" || undefined,
  });

  if (!parsed.success) {
    return {};
  }

  return parsed.data;
}

export async function listAlunos(
  supabase: SupabaseClient,
  escolaId: string,
  filters: AlunoListFilters,
  options: ListOptions = {}
): Promise<ListResult> {
  const hasCursor = Boolean(filters.cursorCreatedAt && filters.cursorId);
  const { limit, from } = kf2Range(filters.limit, hasCursor ? 0 : filters.offset ?? (filters.page ? (filters.page - 1) * (filters.limit || 20) : undefined));
  const status = mapStatusForRpc(filters.status);
  let targetAno = Number.isFinite(filters.ano) ? filters.ano : undefined;
  const pageLimit = Math.min(limit, 50);
  const includeResumo = options.includeResumo || Boolean(filters.includeResumo) || Boolean(filters.turmaId);
  const includeFinanceiro = Boolean(
    options.includeFinanceiro || filters.situacaoFinanceira || filters.statusMatricula || filters.turmaId
  );

  if (!targetAno) {
    const { data: anoRow } = await supabase
      .from("anos_letivos")
      .select("ano")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anoRow?.ano) {
      targetAno = Number(anoRow.ano);
    }
  }

  let turmaNome: string | null = null;
  if (filters.turmaId) {
    const { data: turmaRow, error: turmaErr } = await supabase
      .from("turmas")
      .select("nome")
      .eq("id", filters.turmaId)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (turmaErr) throw turmaErr;
    turmaNome = turmaRow?.nome ?? null;
    if (!turmaNome) {
      return {
        items: [],
        page: { limit: pageLimit, offset: from, nextOffset: null, hasMore: false, nextCursor: null },
      };
    }
  }

  let items: AlunoListItem[] = [];
  let lastCursorItem: any = null;
  let batchCount = 0;
  let cursorCreated = filters.cursorCreatedAt ?? undefined;
  let cursorKey = filters.cursorId ?? undefined;
  let offset = hasCursor ? 0 : from;
  let exhausted = false;

  const needsPostFilter = Boolean(filters.turmaId || filters.situacaoFinanceira || filters.statusMatricula);

  while (items.length < pageLimit) {
    const { data, error } = await supabase.rpc("secretaria_list_alunos_kf2", {
      p_escola_id: escolaId,
      p_status: status,
      p_q: filters.q ?? undefined,
      p_ano_letivo: targetAno ?? undefined,
      p_limit: pageLimit,
      p_offset: offset,
      p_cursor_created_at: cursorCreated,
      p_cursor_id: cursorKey,
    });

    if (error) throw error;

    const mapped = (data ?? []).map((row: any) => ({
      id: row.id,
      aluno_id: row.aluno_id ?? null,
      origem: row.origem ?? "aluno",
      nome: row.nome ?? null,
      email: row.email ?? null,
      responsavel: row.responsavel ?? null,
      telefone_responsavel: row.telefone_responsavel ?? null,
      status: row.status ?? null,
      created_at: row.created_at ?? null,
      numero_login: row.numero_login ?? null,
      numero_processo: row.numero_processo ?? null,
    }));

    if (mapped.length === 0) {
      exhausted = true;
      break;
    }

    lastCursorItem = mapped[mapped.length - 1];

    let enriched = mapped;
    const alunoIds = mapped
      .filter((row) => row.origem === "aluno")
      .map((row) => row.aluno_id ?? row.id)
      .filter(Boolean) as string[];

    if (alunoIds.length > 0) {
      const { data: alunosDetails } = await supabase
        .from("alunos")
        .select(
          "id, responsavel, responsavel_nome, responsavel_contato, encarregado_nome, encarregado_telefone, telefone_responsavel"
        )
        .in("id", alunoIds)
        .eq("escola_id", escolaId);

      const responsavelMap = new Map(
        (alunosDetails ?? []).map((row: any) => [row.id, row])
      );

      enriched = enriched.map((row) => {
        if (row.origem !== "aluno") return row;
        const alunoId = row.aluno_id ?? row.id;
        const detail = responsavelMap.get(alunoId);
        if (!detail) return row;
        return {
          ...row,
          responsavel:
            row.responsavel ??
            detail.responsavel ??
            detail.responsavel_nome ??
            detail.encarregado_nome ??
            null,
          telefone_responsavel:
            row.telefone_responsavel ??
            detail.telefone_responsavel ??
            detail.responsavel_contato ??
            detail.encarregado_telefone ??
            null,
        };
      });
    }

    if (includeResumo && alunoIds.length > 0) {
      const { data: resumoRows } = await supabase
        .from("vw_secretaria_alunos_resumo")
        .select("aluno_id, turma_nome, total_em_atraso")
        .in("aluno_id", alunoIds);

      const resumoByAluno = new Map(
        (resumoRows ?? []).map((row: any) => [row.aluno_id, row])
      );

      enriched = enriched.map((row) => {
        if (row.origem !== "aluno") return row;
        const alunoId = row.aluno_id ?? row.id;
        const resumo = resumoByAluno.get(alunoId);
        return {
          ...row,
          turma_nome: resumo?.turma_nome ?? null,
          total_em_atraso: Number(resumo?.total_em_atraso ?? 0),
        };
      });
    }

    if (includeFinanceiro && alunoIds.length > 0) {
      const { data: matriculas } = await supabase
        .from("matriculas")
        .select(
          "id, aluno_id, status, turma_id, created_at, turmas ( nome, turma_codigo, ano_letivo, cursos ( nome ) )"
        )
        .eq("escola_id", escolaId)
        .in("aluno_id", alunoIds)
        .order("created_at", { ascending: false });

      const matriculaMap = new Map<
        string,
        {
          status: string | null;
          turma_id: string | null;
          turma_nome: string | null;
          turma_codigo: string | null;
          turma_ano: number | null;
          turma_curso: string | null;
        }
      >();

      (matriculas as MatriculaResumo[] | null)?.forEach((row) => {
        if (!row?.aluno_id || matriculaMap.has(row.aluno_id)) return;
        const turma = Array.isArray(row.turmas) ? row.turmas[0] : row.turmas;
        const curso = Array.isArray(turma?.cursos) ? turma?.cursos[0] : turma?.cursos;
        matriculaMap.set(row.aluno_id, {
          status: row.status ?? null,
          turma_id: row.turma_id ?? null,
          turma_nome: turma?.nome ?? null,
          turma_codigo: turma?.turma_codigo ?? null,
          turma_ano: turma?.ano_letivo ?? null,
          turma_curso: curso?.nome ?? null,
        });
      });

      const mensalidadeMap = new Map<
        string,
        { situacao: "em_dia" | "em_atraso" | "sem_registo"; meses: number; valor: number }
      >();

      const { data: mensalidades } = await supabase
        .from("mensalidades")
        .select("aluno_id, status, data_vencimento, valor_previsto, valor, valor_pago_total")
        .eq("escola_id", escolaId)
        .in("aluno_id", alunoIds);

      const today = new Date();
      (mensalidades as MensalidadeResumo[] | null)?.forEach((row) => {
        if (!row?.aluno_id) return;
        const entry = mensalidadeMap.get(row.aluno_id) ?? {
          situacao: "sem_registo" as const,
          meses: 0,
          valor: 0,
        };

        const dueDate = row.data_vencimento ? new Date(row.data_vencimento) : null;
        const statusValue = (row.status ?? "").toLowerCase();
        const isPago = statusValue === "pago" || statusValue === "isento" || statusValue === "cancelado";
        const isOverdue = !isPago && !!dueDate && dueDate < today;

        entry.situacao = entry.situacao === "sem_registo" ? "em_dia" : entry.situacao;
        if (isOverdue) {
          entry.situacao = "em_atraso";
          entry.meses += 1;
          const valorPrevisto = Number(row.valor_previsto ?? row.valor ?? 0);
          const valorPago = Number(row.valor_pago_total ?? 0);
          entry.valor += Math.max(valorPrevisto - valorPago, 0);
        }

        mensalidadeMap.set(row.aluno_id, entry);
      });

      enriched = enriched.map((row) => {
        if (row.origem !== "aluno") {
          return {
            ...row,
            turma_id: null,
            turma_codigo: null,
            turma_ano: null,
            turma_curso: null,
            situacao_financeira: "sem_registo",
            meses_atraso: 0,
            valor_em_divida: 0,
            status_matricula: "sem_matricula",
          };
        }

        const alunoId = row.aluno_id ?? row.id;
        const matricula = matriculaMap.get(alunoId);
        const statusRaw = (matricula?.status ?? "").toLowerCase();
        const statusMatricula = ["ativa", "ativo", "active", "matriculado"].includes(statusRaw)
          ? "matriculado"
          : ["pendente", "rascunho"].includes(statusRaw)
            ? "pendente"
            : "sem_matricula";

        const financeiro = mensalidadeMap.get(alunoId) ?? {
          situacao: "sem_registo" as const,
          meses: 0,
          valor: 0,
        };

        return {
          ...row,
          turma_nome: matricula?.turma_nome ?? row.turma_nome ?? null,
          turma_id: matricula?.turma_id ?? null,
          turma_codigo: matricula?.turma_codigo ?? null,
          turma_ano: matricula?.turma_ano ?? null,
          turma_curso: matricula?.turma_curso ?? null,
          situacao_financeira: financeiro.situacao,
          meses_atraso: financeiro.meses,
          valor_em_divida: financeiro.valor,
          status_matricula: statusMatricula,
        };
      });
    }

    if (turmaNome) {
      enriched = enriched.filter((row) => row.turma_nome === turmaNome || row.turma_id === filters.turmaId);
    }

    if (filters.situacaoFinanceira) {
      enriched = enriched.filter((row) => row.situacao_financeira === filters.situacaoFinanceira);
    }

    if (filters.statusMatricula) {
      enriched = enriched.filter((row) => row.status_matricula === filters.statusMatricula);
    }

    items = items.concat(enriched);

    if (!needsPostFilter && mapped.length < pageLimit) {
      exhausted = true;
      break;
    }

    if (mapped.length < pageLimit) {
      exhausted = true;
      break;
    }

    cursorCreated = lastCursorItem?.created_at ?? undefined;
    cursorKey = lastCursorItem?.id ?? undefined;
    offset = 0;
    batchCount += 1;
    if (batchCount > 10) break;
  }

  if (items.length > pageLimit) {
    items = items.slice(0, pageLimit);
  }

  const hasMore = Boolean(lastCursorItem) && !exhausted;
  const nextCursor = lastCursorItem
    ? { created_at: lastCursorItem.created_at, id: lastCursorItem.id }
    : null;
  const nextOffset = hasMore ? from + items.length : null;

  return {
    items,
    page: {
      limit: pageLimit,
      offset: from,
      nextOffset,
      hasMore,
      nextCursor,
    },
  };
}

export async function listAllAlunos(
  supabase: SupabaseClient,
  escolaId: string,
  filters: AlunoListFilters,
  options: ListOptions = {}
): Promise<AlunoListItem[]> {
  let cursorCreatedAt: string | undefined;
  let cursorId: string | undefined;
  const all: AlunoListItem[] = [];
  let iterations = 0;

  while (true) {
    const { items, page } = await listAlunos(
      supabase,
      escolaId,
      {
        ...filters,
        cursorCreatedAt,
        cursorId,
        page: undefined,
        offset: undefined,
      },
      options
    );

    all.push(...items);

    if (!page.hasMore || !page.nextCursor) break;

    cursorCreatedAt = page.nextCursor.created_at;
    cursorId = page.nextCursor.id;

    iterations += 1;
    if (iterations > 200 || all.length >= 10000) break;
  }

  return all;
}
