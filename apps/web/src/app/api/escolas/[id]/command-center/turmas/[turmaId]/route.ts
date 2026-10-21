import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearScope, AcademicYearContextError } from "@/lib/academic-year/context";

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
export async function GET(
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
    const historic = year.status !== "ACTIVE";
    const start = (parsed.data.page - 1) * PAGE_SIZE;

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
      .range(start, start + PAGE_SIZE - 1);
    if (historic) studentsQuery = studentsQuery.in("status", ["ativo", "concluido"]);
    else studentsQuery = studentsQuery.eq("status", "ativo").eq("ativo", true);

    // Do not use the existing turma-details API: it truncates enrollments to 50
    // and mixes financial and historical data in the same payload.
    const [enrollmentReply, disciplineReply, assignmentReply] = await Promise.all([
      studentsQuery,
      supabase.from("turma_disciplinas")
        .select("id,curso_matriz_id,professor_id,curso_matriz(id,disciplina_id,disciplinas_catalogo(id,nome))")
        .eq("escola_id", escolaId).eq("turma_id", turmaId)
        .order("id", { ascending: true }).limit(MAX_DISCIPLINES + 1),
      supabase.from("turma_disciplinas_professores")
        .select("id,professor_id,disciplina_id")
        .eq("escola_id", escolaId).eq("turma_id", turmaId)
        .order("id", { ascending: true }).limit(MAX_DISCIPLINES + 1),
    ]);

    if (enrollmentReply.error) throw enrollmentReply.error;
    if (disciplineReply.error) throw disciplineReply.error;
    if (assignmentReply.error) throw assignmentReply.error;

    const disciplines = (disciplineReply.data ?? []) as unknown as DisciplineRow[];
    const assignments = assignmentReply.data ?? [];
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

    const subjectsById = new Map<string, { id: string; nome: string; professores: Set<string> }>();
    for (const d of disciplines) {
      const catalog = d.curso_matriz?.disciplinas_catalogo;
      const id = catalog?.id || d.curso_matriz?.disciplina_id;
      if (!id) continue;
      if (!subjectsById.has(id)) subjectsById.set(id, { id, nome: catalog?.nome || "Disciplina", professores: new Set() });
      if (d.professor_id && teachers.has(d.professor_id)) subjectsById.get(id)!.professores.add(teachers.get(d.professor_id)!);
    }
    for (const a of assignments) {
      const id = a.disciplina_id;
      if (!id || !subjectsById.has(id) || !a.professor_id || !teachers.has(a.professor_id)) continue;
      subjectsById.get(id)!.professores.add(teachers.get(a.professor_id)!);
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
        disciplinas: [...subjectsById.values()].map((d) => ({ id: d.id, nome: d.nome, professores: [...d.professores].sort() })),
        professores: [...new Set([...subjectsById.values()].flatMap((d) => [...d.professores]))].sort(),
        disciplinasLimitadas: disciplines.length > MAX_DISCIPLINES || assignments.length > MAX_DISCIPLINES,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: cause.message }, { status: cause.status });
    }
    console.error("[command-center/turma] read failed", cause instanceof Error ? cause.message : "unexpected");
    return NextResponse.json({ ok: false, error: "Não foi possível carregar esta turma." }, { status: 500 });
  }
}
