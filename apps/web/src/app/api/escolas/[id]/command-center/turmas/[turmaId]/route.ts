import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withExplorerObservability } from "@/lib/command-center/observability";

import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearScope, AcademicYearContextError } from "@/lib/academic-year/context";
import { TURMA_DISCIPLINAS_SELECT, turmaEnrollmentPolicy, turmaPageRange } from "@/lib/command-center/turma-explorer-policy";

export const dynamic = "force-dynamic";

const schema = z.object({
  escolaId: z.string().uuid(),
  turmaId: z.string().uuid(),
  anoLetivoId: z.string().uuid().nullable(),
  page: z.coerce.number().int().min(1).max(10000),
});

// The explorer is an academic, read-only surface: no payments, BI, contacts or grades.
const PAGE_SIZE = 20;
const MAX_DISCIPLINES = 100;
const MAX_SCHEDULE_SLOTS = 300;

type TeacherRow = {
  id: string;
  apelido: string | null;
  profiles?: { nome?: string | null } | { nome?: string | null }[] | null;
};
type DisciplineRow = {
  id: string;
  curso_matriz_id?: string | null;
  professor_id?: string | null;
  curso_matriz?: {
    disciplina_id?: string | null;
    disciplinas_catalogo?: { id: string; nome: string } | null;
  } | null;
};

/**
 * Never delegate authorization to the global-search result.
 * A 404 also covers a turma belonging to another school or academic year.
 */
async function readExplorer(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; turmaId: string }> },
) {
  const { id: escolaIdParam, turmaId } = await params;
  const url = new URL(req.url);
  const parsed = schema.safeParse({
    escolaId: escolaIdParam,
    turmaId,
    anoLetivoId: url.searchParams.get("ano_letivo_id"),
    page: url.searchParams.get("page") ?? 1,
  });
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Parâmetros inválidos." }, { status: 400 });

  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, parsed.data.escolaId);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Sem acesso à escola." }, { status: 403 });

    const auth = await requireRoleInSchool({
      supabase, escolaId, productContext: "k12",
      roles: ["admin", "admin_escola", "staff_admin", "diretor",
        "secretaria", "admin_secretaria", "secretaria_financeiro", "admin_financeiro"],
    });
    if (auth.error) return auth.error;

    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: parsed.data.anoLetivoId, operation: "READ",
    });

    const { data: turma, error: turmaError } = await supabase
      .from("turmas")
      .select("id,nome,turno,sala,capacidade_maxima,ano_letivo,ano_letivo_id,classe_id,curso_id,status_validacao,classes(id,nome),cursos(id,nome)")
      .eq("id", turmaId)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (turmaError) throw turmaError;
    if (!turma || (turma.ano_letivo_id
      ? turma.ano_letivo_id !== year.id
      : turma.ano_letivo !== year.ano)) {
      return NextResponse.json({ ok: false, error: "Turma não encontrada neste ano letivo." }, { status: 404 });
    }

    // Historical READ includes concluded enrollments, but never transferred-out ones.
    // Active-year counts only include enrolled students who remain active.
    const historic = year.status === "CLOSED";
    const { from: start, to: end } = turmaPageRange(parsed.data.page, PAGE_SIZE);
    const policy = turmaEnrollmentPolicy(historic);

    let studentsQuery = supabase
      .from("matriculas")
      .select("id,aluno_id,numero_chamada,alunos!inner(id,nome,nome_completo,deleted_at,escola_id)", { count: "exact" })
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .eq("ano_letivo", year.ano)
      .eq("alunos.escola_id", escolaId)
      .is("alunos.deleted_at", null)
      .order("numero_chamada", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(start, end);
    studentsQuery = studentsQuery.in("status", [...policy.statuses]);
    if (policy.requireActive) studentsQuery = studentsQuery.eq("ativo", true);

    // Do not use the existing turma-details API: it truncates enrollments to 50
    // and mixes financial and historical data in the same payload.
    const [enrollmentReply, disciplineReply, assignmentReply, scheduleReply] = await Promise.all([
      studentsQuery,
      supabase.from("turma_disciplinas")
        .select(TURMA_DISCIPLINAS_SELECT)
        .eq("escola_id", escolaId).eq("turma_id", turmaId)
        .order("id", { ascending: true }).limit(MAX_DISCIPLINES + 1),
      supabase.from("turma_disciplinas_professores")
        .select("id,professor_id,disciplina_id")
        .eq("escola_id", escolaId).eq("turma_id", turmaId)
        .order("id", { ascending: true }).limit(MAX_DISCIPLINES + 1),
      supabase.from("quadro_horarios")
        .select("id,professor_id,disciplina_id,versao_id")
        .eq("escola_id", escolaId).eq("turma_id", turmaId)
        .order("id", { ascending: true }).limit(MAX_SCHEDULE_SLOTS + 1),
    ]);

    if (enrollmentReply.error) throw enrollmentReply.error;
    if (disciplineReply.error) throw disciplineReply.error;
    if (assignmentReply.error) throw assignmentReply.error;
    if (scheduleReply.error) throw scheduleReply.error;

    // Include teachers whose only visible allocation is in a PUBLISHED timetable.
    // Draft or archived timetable versions must not create professor links.
    const scheduleVersionIds = [...new Set((scheduleReply.data ?? [])
      .map((row) => row.versao_id).filter((id): id is string => Boolean(id)))];
    const publishedVersionIds = new Set<string>();
    if (scheduleVersionIds.length) {
      const { data: rows, error } = await supabase.from("horario_versoes")
        .select("id").eq("escola_id", escolaId).eq("turma_id", turmaId)
        .eq("status", "publicada").in("id", scheduleVersionIds);
      if (error) throw error;
      for (const version of rows ?? []) publishedVersionIds.add(version.id);
    }
    const publishedAssignments = (scheduleReply.data ?? [])
      .filter((row) => row.versao_id && publishedVersionIds.has(row.versao_id) && row.professor_id)
      .map((row) => ({ id: row.id, professor_id: row.professor_id, disciplina_id: row.disciplina_id }));

    const disciplines = (disciplineReply.data ?? []) as unknown as DisciplineRow[];
    const assignments = [...(assignmentReply.data ?? []), ...publishedAssignments];
    const teacherIds = [...new Set([
      ...disciplines.map((d) => d.professor_id).filter((id): id is string => Boolean(id)),
      ...assignments.map((a) => a.professor_id).filter((id): id is string => Boolean(id)),
    ])];

    const teachers = new Map<string, string>();
    if (teacherIds.length) {
      const { data: rows, error } = await supabase.from("professores")
        .select("id,apelido,profiles(nome)")
        .eq("escola_id", escolaId).in("id", teacherIds);
      if (error) throw error;
      for (const teacher of (rows ?? []) as unknown as TeacherRow[]) {
        const profile = Array.isArray(teacher.profiles) ? teacher.profiles[0] : teacher.profiles;
        teachers.set(teacher.id, profile?.nome || teacher.apelido || "Professor");
      }
    }

    // Legacy assignments can exist without a turma_disciplinas row.
    // Resolve names from the tenant-scoped catalogue before merging them.
    const missingSubjectIds = [...new Set(assignments.map((a) => a.disciplina_id).filter(
      (id): id is string => Boolean(id) && !disciplines.some((d) => d.curso_matriz?.disciplina_id === id),
    ))];
    const legacyNames = new Map<string, string>();
    if (missingSubjectIds.length) {
      const { data: catalog, error } = await supabase.from("disciplinas_catalogo")
        .select("id,nome").eq("escola_id", escolaId).in("id", missingSubjectIds);
      if (error) throw error;
      for (const subject of catalog ?? []) legacyNames.set(subject.id, subject.nome);
    }

    const subjectsById = new Map<string, { id: string; nome: string; professores: Set<string>; professorIds: Set<string> }>();
    for (const d of disciplines) {
      const catalog = d.curso_matriz?.disciplinas_catalogo;
      const id = catalog?.id || d.curso_matriz?.disciplina_id;
      if (!id) continue;
      if (!subjectsById.has(id)) subjectsById.set(id, { id, nome: catalog?.nome || "Disciplina", professores: new Set(), professorIds: new Set() });
      if (d.professor_id && teachers.has(d.professor_id)) {
        subjectsById.get(id)!.professores.add(teachers.get(d.professor_id)!);
        subjectsById.get(id)!.professorIds.add(d.professor_id);
      }
    }
    for (const a of assignments) {
      const id = a.disciplina_id;
      if (!id) continue;
      if (!subjectsById.has(id) && legacyNames.has(id)) subjectsById.set(id, { id, nome: legacyNames.get(id)!, professores: new Set(), professorIds: new Set() });
      if (!subjectsById.has(id) || !a.professor_id || !teachers.has(a.professor_id)) continue;
      subjectsById.get(id)!.professores.add(teachers.get(a.professor_id)!);
      subjectsById.get(id)!.professorIds.add(a.professor_id);
    }

    const students = (enrollmentReply.data ?? []).map((row) => {
      const aluno = row.alunos as { id: string; nome: string | null; nome_completo: string | null };
      return {
        id: aluno.id,
        nome: aluno.nome_completo || aluno.nome || "Aluno",
        numeroChamada: row.numero_chamada,
      };
    });
    const total = enrollmentReply.count ?? 0;
    return NextResponse.json({
      ok: true,
      data: {
        turma: {
          id: turma.id, nome: turma.nome, turno: turma.turno, sala: turma.sala,
          classe: turma.classes, curso: turma.cursos, capacidade: turma.capacidade_maxima,
          anoLetivo: { id: year.id, ano: year.ano, historico: historic },
        },
        alunos: { items: students, total, page: parsed.data.page, pageSize: PAGE_SIZE, hasMore: start + students.length < total },
        disciplinas: [...subjectsById.values()].map((d) => ({
          id: d.id, nome: d.nome, professores: [...d.professores].sort(),
          professoresDetalhes: [...d.professorIds].map((id) => ({ id, nome: teachers.get(id)! }))
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt")),
        })),
        professores: [...new Set([...subjectsById.values()].flatMap((d) => [...d.professores]))].sort(),
        professoresDetalhes: [...teachers.entries()].map(([id, nome]) => ({ id, nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt")),
        disciplinasLimitadas: disciplines.length > MAX_DISCIPLINES || (assignmentReply.data ?? []).length > MAX_DISCIPLINES || (scheduleReply.data ?? []).length > MAX_SCHEDULE_SLOTS,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: cause.message }, { status: cause.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível carregar esta turma." }, { status: 500 });
  }
}

/** Stable envelope and PII-free correlation across success, 4xx and 5xx. */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; turmaId: string }> },
) {
  return withExplorerObservability("turma", () => readExplorer(req, context));
}
