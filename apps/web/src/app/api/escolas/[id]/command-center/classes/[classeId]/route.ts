import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withExplorerObservability } from "@/lib/command-center/observability";

import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { requireCommandCenterSchoolWideAccess } from "@/lib/command-center/school-wide-scope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";
import {
  composeClasseOverview, isClasseTurmaInYear, isClasseAvailableInYear,
  type ClasseAssignment, type ClasseTurma,
} from "@/lib/command-center/classe-explorer";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  escolaId: z.string().uuid(),
  classeId: z.string().uuid(),
  academicYearId: z.string().uuid().nullable(),
  page: z.coerce.number().int().min(1).max(10000),
});
const classRosterSchema = z.object({
  total: z.number().int().nonnegative(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  items: z.array(z.object({
    id: z.string().uuid(),
    nome: z.string(),
    turmaId: z.string().uuid(),
    turmaNome: z.string(),
    numeroChamada: z.number().int().nullable(),
  })),
});
const CLASS_ROSTER_PAGE_SIZE = 20;
const MAX_TURMAS = 200;
const MAX_MATRIZ = 300;
const MAX_ALLOCS = 500;
const MAX_SCHEDULE_ROWS = 900;

type Joined<T> = T | T[] | null;
type ClassRow = {
  id: string; nome: string; numero: number | null;
  curso_id: string | null; ano_letivo_id: string | null;
  carga_horaria_semanal: number | null;
  cursos: Joined<{ id: string; nome: string; codigo: string | null }>;
};
type TurmaRow = {
  id: string; nome: string; turno: string | null; sala: string | null;
  capacidade_maxima: number | null; curso_id: string | null;
  ano_letivo: number | null; ano_letivo_id: string | null;
};
type MatrizRow = {
  id: string; disciplina_id: string | null;
  carga_horaria_semanal: number | null; obrigatoria: boolean | null; ativo: boolean | null;
};
type AssignmentRow = {
  turma_id: string; professor_id: string | null;
};
type DirectRow = AssignmentRow & { curso_matriz_id: string | null };
type LegacyRow = AssignmentRow & { disciplina_id: string | null };
type TimetableRow = LegacyRow & { versao_id: string | null };
type TeacherRow = {
  id: string; apelido: string | null;
  profiles: Joined<{ nome: string | null; deleted_at: string | null }>;
};

function first<T>(row: Joined<T>) {
  return Array.isArray(row) ? row[0] ?? null : row;
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Authorized academic overview. A class can exist without active turmas in a
 * year: that is a valid empty state. Never use the client-supplied class name
 * or global search result as proof of authorization.
 */
async function readExplorer(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; classeId: string }> },
) {
  const { id, classeId } = await params;
  const url = new URL(req.url);
  const parsed = requestSchema.safeParse({
    escolaId: id,
    classeId,
    academicYearId: url.searchParams.get("ano_letivo_id"),
    page: url.searchParams.get("page") ?? 1,
  });
  if (!parsed.success) return noStore({ ok: false, error: "Parâmetros inválidos." }, 400);

  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return noStore({ ok: false, error: "Não autenticado." }, 401);

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, parsed.data.escolaId);
    if (!escolaId) return noStore({ ok: false, error: "Sem acesso à escola." }, 403);

    const permission = await requireRoleInSchool({
      supabase, escolaId, productContext: "k12",
      roles: ["admin", "admin_escola", "staff_admin", "diretor", "secretaria",
        "admin_secretaria", "secretaria_financeiro", "admin_financeiro"],
    });
    if (permission.error) return permission.error;
    const schoolScopeError = await requireCommandCenterSchoolWideAccess(supabase, user.id, escolaId, req);
    if (schoolScopeError) return schoolScopeError;

    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: parsed.data.academicYearId, operation: "READ",
    });
    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id,nome,numero,curso_id,ano_letivo_id,carga_horaria_semanal,cursos(id,nome,codigo)")
      .eq("escola_id", escolaId).eq("id", parsed.data.classeId).maybeSingle();
    if (classError) throw classError;
    const classe = classData as unknown as ClassRow | null;
    if (!classe) {
      return noStore({ ok: false, error: "Classe não encontrada neste ano letivo." }, 404);
    }

    const { data: turmaData, error: turmaError } = await supabase.from("turmas")
      .select("id,nome,turno,sala,capacidade_maxima,curso_id,ano_letivo,ano_letivo_id")
      .eq("escola_id", escolaId).eq("classe_id", classe.id)
      .or(`ano_letivo_id.eq.${year.id},and(ano_letivo_id.is.null,ano_letivo.eq.${year.ano})`)
      .order("id", { ascending: true }).limit(MAX_TURMAS + 1);
    if (turmaError) throw turmaError;
    let limitado = (turmaData ?? []).length > MAX_TURMAS;
    const turmas: ClasseTurma[] = ((turmaData ?? []) as TurmaRow[])
      .filter((row) => !classe.curso_id || row.curso_id === classe.curso_id)
      .map((row) => ({
        id: row.id, nome: row.nome, turno: row.turno, sala: row.sala,
        capacidade: row.capacidade_maxima, cursoId: row.curso_id,
        anoLetivo: row.ano_letivo, anoLetivoId: row.ano_letivo_id,
      }))
      .filter((row) => isClasseTurmaInYear(row, year))
      .slice(0, MAX_TURMAS);
    // Explicit classe.ano_letivo_id is often stale because KLASSE reuses
    // classe rows across years. A real turma in the requested year remains valid.
    if (!isClasseAvailableInYear(classe.ano_letivo_id, year.id, turmas)) {
      return noStore({ ok: false, error: "Classe não encontrada neste ano letivo." }, 404);
    }
    const turmaIds = turmas.map((turma) => turma.id);

    // One SECURITY INVOKER aggregation replaces up to six 500-row PostgREST
    // requests. The function applies the same year, school and status policy.
    const { data: rosterJson, error: rosterError } = await supabase.rpc(
      "command_center_class_roster_summary", {
        p_escola_id: escolaId, p_classe_id: classe.id,
        p_ano_letivo_id: year.id, p_ano_letivo: year.ano,
        p_historico: year.status === "CLOSED",
        p_page: parsed.data.page, p_page_size: CLASS_ROSTER_PAGE_SIZE,
      },
    );
    if (rosterError) throw rosterError;
    const parsedRoster = classRosterSchema.safeParse(rosterJson);
    if (!parsedRoster.success) throw new Error("Invalid class roster summary shape");
    const roster = parsedRoster.data;

    const matrixReply = await supabase.from("curso_matriz")
      .select("id,disciplina_id,carga_horaria_semanal,obrigatoria,ativo")
      .eq("escola_id", escolaId).eq("classe_id", classe.id)
      .order("id", { ascending: true }).limit(MAX_MATRIZ + 1);
    if (matrixReply.error) throw matrixReply.error;
    const allMatrix = (matrixReply.data ?? []) as MatrizRow[];
    if (allMatrix.length > MAX_MATRIZ) limitado = true;
    const matrix = allMatrix.slice(0, MAX_MATRIZ).filter((row) => row.ativo !== false && row.disciplina_id);
    const matrixSubjectMap = new Map(matrix.map((row) => [row.id, row.disciplina_id!] as const));

    const [directReply, legacyReply, timetableReply] = await Promise.all([
      turmaIds.length
        ? supabase.from("turma_disciplinas")
          .select("turma_id,curso_matriz_id,professor_id")
          .eq("escola_id", escolaId).in("turma_id", turmaIds)
          .order("id", { ascending: true }).limit(MAX_ALLOCS + 1)
        : Promise.resolve({ data: [] as DirectRow[], error: null }),
      turmaIds.length
        ? supabase.from("turma_disciplinas_professores")
          .select("turma_id,disciplina_id,professor_id")
          .eq("escola_id", escolaId).in("turma_id", turmaIds)
          .order("id", { ascending: true }).limit(MAX_ALLOCS + 1)
        : Promise.resolve({ data: [] as LegacyRow[], error: null }),
      turmaIds.length
        ? supabase.from("quadro_horarios")
          .select("turma_id,disciplina_id,professor_id,versao_id")
          .eq("escola_id", escolaId).in("turma_id", turmaIds)
          .order("id", { ascending: true }).limit(MAX_SCHEDULE_ROWS + 1)
        : Promise.resolve({ data: [] as TimetableRow[], error: null }),
    ]);
    if (directReply.error) throw directReply.error;
    if (legacyReply.error) throw legacyReply.error;
    if (timetableReply.error) throw timetableReply.error;
    const direct = (directReply.data ?? []) as DirectRow[];
    const legacy = (legacyReply.data ?? []) as LegacyRow[];
    const timetable = (timetableReply.data ?? []) as TimetableRow[];
    if (direct.length > MAX_ALLOCS || legacy.length > MAX_ALLOCS || timetable.length > MAX_SCHEDULE_ROWS) {
      limitado = true;
    }

    const publishedIds = [...new Set(timetable.slice(0, MAX_SCHEDULE_ROWS)
      .map((row) => row.versao_id).filter((id): id is string => Boolean(id)))];
    const published = new Map<string, string>();
    if (publishedIds.length) {
      const { data, error } = await supabase.from("horario_versoes")
        .select("id,turma_id")
        .eq("escola_id", escolaId).eq("status", "publicada").in("id", publishedIds);
      if (error) throw error;
      for (const row of data ?? []) published.set(row.id, row.turma_id);
    }

    const assignments: ClasseAssignment[] = [
      ...direct.slice(0, MAX_ALLOCS).flatMap((row) => {
        const disciplinaId = row.curso_matriz_id ? matrixSubjectMap.get(row.curso_matriz_id) : null;
        // Direct links without a valid class curriculum relation must not
        // assign an unrelated subject or professor to this class.
        if (!disciplinaId) return [];
        return [{ turmaId: row.turma_id, disciplinaId, professorId: row.professor_id }];
      }),
      ...legacy.slice(0, MAX_ALLOCS).map((row) => ({
        turmaId: row.turma_id, disciplinaId: row.disciplina_id, professorId: row.professor_id,
      })),
      ...timetable.slice(0, MAX_SCHEDULE_ROWS).filter((row) =>
        Boolean(row.versao_id && published.get(row.versao_id) === row.turma_id),
      ).map((row) => ({
        turmaId: row.turma_id, disciplinaId: row.disciplina_id, professorId: row.professor_id,
      })),
    ];
    const ids = new Set([
      ...matrix.map((row) => row.disciplina_id!),
      ...assignments.map((row) => row.disciplinaId).filter((id): id is string => Boolean(id)),
    ]);
    const teacherIds = [...new Set(assignments
      .map((row) => row.professorId).filter((id): id is string => Boolean(id)))];

    const [subjectsReply, teachersReply] = await Promise.all([
      ids.size
        ? supabase.from("disciplinas_catalogo").select("id,nome")
          .eq("escola_id", escolaId).in("id", [...ids])
        : Promise.resolve({ data: [] as Array<{ id: string; nome: string }>, error: null }),
      teacherIds.length
        ? supabase.from("professores")
          .select("id,apelido,profiles(nome,deleted_at)")
          .eq("escola_id", escolaId).in("id", teacherIds)
        : Promise.resolve({ data: [] as TeacherRow[], error: null }),
    ]);
    if (subjectsReply.error) throw subjectsReply.error;
    if (teachersReply.error) throw teachersReply.error;
    const teacherRows = (teachersReply.data ?? []) as unknown as TeacherRow[];
    const teachers = teacherRows.flatMap((row) => {
      const profile = first(row.profiles);
      if (profile?.deleted_at) return [];
      return [{ id: row.id, nome: profile?.nome?.trim() || row.apelido?.trim() || "Professor" }];
    });

    const overview = composeClasseOverview({
      year, turmas, enrollments: [],
      curriculum: matrix.map((row) => ({
        id: row.id, disciplinaId: row.disciplina_id!,
        cargaHorariaSemanal: row.carga_horaria_semanal, obrigatoria: row.obrigatoria,
      })),
      assignments,
      subjects: subjectsReply.data ?? [],
      teachers,
      page: parsed.data.page,
    });
    const completeOverview = {
      ...overview,
      stats: { ...overview.stats, alunos: roster.total },
      turmas: overview.turmas.map((turma) => ({ ...turma, alunos: roster.counts[turma.id] ?? 0 })),
      alunos: {
        items: roster.items, total: roster.total, page: parsed.data.page,
        pageSize: CLASS_ROSTER_PAGE_SIZE,
        hasMore: parsed.data.page * CLASS_ROSTER_PAGE_SIZE < roster.total,
      },
    };
    return noStore({
      ok: true,
      data: {
        classe: {
          id: classe.id, nome: classe.nome, numero: classe.numero,
          cargaHorariaSemanal: classe.carga_horaria_semanal,
          curso: first(classe.cursos),
        },
        anoLetivo: { id: year.id, ano: year.ano, historico: year.status === "CLOSED" },
        ...completeOverview,
        limitado,
      },
    });
  } catch (error) {
    if (error instanceof AcademicYearContextError) return noStore(
      { ok: false, error: error.message }, error.status,
    );
    return noStore({ ok: false, error: "Não foi possível carregar esta classe." }, 500);
  }
}

/** Stable envelope and PII-free correlation across success, 4xx and 5xx. */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; classeId: string }> },
) {
  return withExplorerObservability("classe", () => readExplorer(req, context));
}
