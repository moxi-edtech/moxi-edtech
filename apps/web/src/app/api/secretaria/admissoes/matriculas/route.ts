import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const CANONICAL_STATUSES = [
  "rascunho", "pendente", "ativo", "concluido", "transferido", "anulado", "trancado", "desistente",
] as const;

const Filters = z.object({
  ano_letivo_id: z.string().uuid(),
  ano: z.coerce.number().int().min(2000).max(2150),
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  turma_id: z.union([z.string().uuid(), z.literal("null")]).optional(),
  curso_id: z.string().uuid().optional(),
  classe_id: z.string().uuid().optional(),
  ensino: z.enum(["primario", "ciclo1", "ciclo2"]).optional(),
  status: z.enum(CANONICAL_STATUSES).optional(),
  status_in: z.string().max(250).optional(),
});

type Params = z.infer<typeof Filters>;
const noop = () => NextResponse.json({
  ok: true, items: [], total: 0, summary: { ativos: 0, pendentes: 0 },
});

// Escape PostgREST OR syntax; '%' and '_' are LIKE wildcards, not literal
// search terms. User input can never inject another filter.
function searchPattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&").replace(/[(),"]/g, "").trim();
}

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const parsed = Filters.safeParse(Object.fromEntries(search.entries()));
    if (!parsed.success) {
      return NextResponse.json({
        ok: false, error: "Filtros inválidos. Verifique o ano letivo e tente novamente.",
      }, { status: 400 });
    }
    const filter = parsed.data;
    const statuses = filter.status_in
      ? filter.status_in.split(",").map((status) => status.trim()).filter(Boolean)
      : filter.status ? [filter.status] : [];
    if (statuses.some((status) => !(CANONICAL_STATUSES as readonly string[]).includes(status))) {
      return NextResponse.json({ ok: false, error: "Estado da matrícula inválido." }, { status: 400 });
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada." }, { status: 403 });
    const role = await requireRoleInSchool({
      supabase, escolaId, roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
    });
    if (role.error) return role.error;

    // Never derive an academic year from the wall clock or silently select
    // between duplicate school years. The UI supplies the official year UUID.
    const year = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: filter.ano_letivo_id,
      operation: "READ",
    });
    if (year.escolaId !== escolaId || Number(year.anoLetivoLabel.slice(0, 4)) !== filter.ano) {
      return NextResponse.json({
        ok: false, code: "ACADEMIC_YEAR_MISMATCH",
        error: "O ano letivo selecionado não corresponde à sessão da escola.",
      }, { status: 409 });
    }

    let turmaIds: string[] | null = null;
    if (filter.curso_id || filter.classe_id || filter.ensino) {
      let classeIds: string[] | null = null;
      if (filter.ensino) {
        const bounds: Record<NonNullable<Params["ensino"]>, [number, number]> = {
          primario: [1, 6], ciclo1: [7, 9], ciclo2: [10, 13],
        };
        const [first, last] = bounds[filter.ensino];
        let classesQuery = supabase.from("classes").select("id")
          .eq("escola_id", escolaId).gte("numero", first).lte("numero", last)
          .limit(1000);
        if (filter.curso_id) classesQuery = classesQuery.eq("curso_id", filter.curso_id);
        if (filter.classe_id) classesQuery = classesQuery.eq("id", filter.classe_id);
        const { data: classes, error: classError } = await classesQuery;
        if (classError || (classes?.length ?? 0) >= 1000) throw new Error("Não foi possível validar as classes do filtro.");
        classeIds = (classes ?? []).map((row: { id: string }) => row.id);
      } else if (filter.classe_id) {
        classeIds = [filter.classe_id];
      }
      if (classeIds !== null && classeIds.length === 0) return noop();

      let turmaQuery = supabase.from("turmas").select("id")
        .eq("escola_id", escolaId).eq("session_id", year.anoLetivoId).limit(1000);
      if (filter.curso_id) turmaQuery = turmaQuery.eq("curso_id", filter.curso_id);
      if (classeIds) turmaQuery = turmaQuery.in("classe_id", classeIds);
      const { data: turmas, error: turmasError } = await turmaQuery;
      if (turmasError || (turmas?.length ?? 0) >= 1000) throw new Error("Não foi possível validar as turmas do filtro.");
      turmaIds = (turmas ?? []).map((row: { id: string }) => row.id);
      if (filter.turma_id && filter.turma_id !== "null") {
        turmaIds = turmaIds.filter((id) => id === filter.turma_id);
      }
      if (turmaIds.length === 0) return noop();
    }

    const term = searchPattern(filter.q);
    const makeQuery = (forCount: boolean) => {
      const projection = forCount
        ? "id, alunos!inner(id)"
        : `id, aluno_id, turma_id, numero_matricula, numero_chamada,
           data_matricula, created_at, status,
           alunos!inner(nome, nome_completo, bi_numero),
           turmas(nome, sala, turno, classes(nome))`;
      let query = supabase.from("matriculas").select(projection, {
        count: "exact", head: forCount,
      }).eq("escola_id", escolaId)
        .eq("session_id", year.anoLetivoId)
        .eq("ano_letivo", filter.ano);

      if (filter.turma_id === "null") query = query.is("turma_id", null);
      else if (turmaIds) query = query.in("turma_id", turmaIds);
      else if (filter.turma_id) query = query.eq("turma_id", filter.turma_id);
      if (statuses.length) query = query.in("status", statuses);
      if (term) {
        query = query.or(
          `nome.ilike.%${term}%,nome_completo.ilike.%${term}%,bi_numero.ilike.%${term}%`,
          { referencedTable: "alunos" },
        );
      }
      return query;
    };

    const [listing, active, pending] = await Promise.all([
      makeQuery(false).order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize - 1),
      makeQuery(true).eq("status", "ativo").eq("ativo", true),
      makeQuery(true).eq("status", "pendente"),
    ]);

    const problem = listing.error || active.error || pending.error;
    if (problem || listing.count === null || active.count === null || pending.count === null) {
      console.error("[matriculas/list] Falha na consulta agregada", problem?.code);
      return NextResponse.json({
        ok: false, error: "Não foi possível verificar as matrículas e os totais. Tente novamente.",
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      items: (listing.data ?? []).map((row: any) => {
        const aluno = Array.isArray(row.alunos) ? row.alunos[0] : row.alunos;
        const turma = Array.isArray(row.turmas) ? row.turmas[0] : row.turmas;
        const classe = Array.isArray(turma?.classes) ? turma.classes[0] : turma?.classes;
        return {
          id: row.id,
          aluno_id: row.aluno_id,
          turma_id: row.turma_id,
          numero_matricula: row.numero_matricula,
          numero_chamada: row.numero_chamada,
          aluno_nome: aluno?.nome_completo || aluno?.nome || null,
          turma_nome: turma?.nome ?? null,
          sala: turma?.sala ?? null,
          turno: turma?.turno ?? null,
          classe_nome: classe?.nome ?? null,
          status: row.status,
          data_matricula: row.data_matricula,
          created_at: row.created_at,
        };
      }),
      total: listing.count,
      summary: { ativos: active.count, pendentes: pending.count },
      year_id: year.anoLetivoId,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, {
        status: error.status,
      });
    }
    console.error("[matriculas/list] Não foi possível concluir a consulta",
      error instanceof Error ? error.name : "unknown");
    return NextResponse.json({
      ok: false, error: "Não foi possível consultar as matrículas. Tente novamente.",
    }, { status: 503 });
  }
}
