import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withExplorerObservability } from "@/lib/command-center/observability";

import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { requireCommandCenterSchoolWideAccess } from "@/lib/command-center/school-wide-scope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";
import {
  composeDisciplinaOverview, isDisciplinaTurmaInYear, isPublishedDisciplinaVersion,
  type DisciplinaAssignment, type DisciplinaCurriculumRow, type DisciplinaTeacher,
  type DisciplinaTurmaRow,
} from "@/lib/command-center/disciplina-explorer";
import { isClassInAcademicYear } from "@/lib/command-center/academic-relations";

export const dynamic = "force-dynamic";

const schema = z.object({
  escolaId: z.string().uuid(),
  disciplinaId: z.string().uuid(),
  academicYearId: z.string().uuid().nullable(),
});

// Limits apply independently. Any truncation must be flagged, never shown as exact totals.
const MAX_MATRIZ = 300;
const MAX_LINKS = 500;
const MAX_TURMAS = 200;

type MatrizRow = {
  id: string;
  curso_id: string | null;
  classe_id: string | null;
  ativo: boolean | null;
  carga_horaria_semanal: number | null;
  obrigatoria: boolean | null;
};
type LinkRow = { turma_id: string; professor_id: string | null };
type ScheduleRow = LinkRow & { versao_id: string | null };
type TurmaRow = {
  id: string;
  nome: string;
  turno: string | null;
  ano_letivo: number | null;
  ano_letivo_id: string | null;
  classes: { id: string; nome: string } | Array<{ id: string; nome: string }> | null;
  cursos: { id: string; nome: string } | Array<{ id: string; nome: string }> | null;
};
type TeacherRow = {
  id: string;
  apelido: string | null;
  profiles?: { nome?: string | null; deleted_at?: string | null } |
    Array<{ nome?: string | null; deleted_at?: string | null }> | null;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Academic subject explorer: course curriculum is a reference; teacher/turma
 * assignments are validated against the *selected* year. No grades or payments.
 */
async function readExplorer(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; disciplinaId: string }> },
) {
  const { id, disciplinaId } = await params;
  const parsed = schema.safeParse({
    escolaId: id,
    disciplinaId,
    academicYearId: new URL(req.url).searchParams.get("ano_letivo_id"),
  });
  if (!parsed.success) return NextResponse.json(
    { ok: false, error: "Parâmetros inválidos." }, { status: 400 },
  );

  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(
      { ok: false, error: "Não autenticado." }, { status: 401 },
    );
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, parsed.data.escolaId);
    if (!escolaId) return NextResponse.json(
      { ok: false, error: "Sem acesso à escola." }, { status: 403 },
    );
    const permission = await requireRoleInSchool({
      supabase, escolaId, productContext: "k12",
      roles: ["admin", "admin_escola", "staff_admin", "diretor",
        "secretaria", "admin_secretaria", "secretaria_financeiro", "admin_financeiro"],
    });
    if (permission.error) return permission.error;
    const schoolScopeError = await requireCommandCenterSchoolWideAccess(supabase, user.id, escolaId, req);
    if (schoolScopeError) return schoolScopeError;
    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: parsed.data.academicYearId, operation: "READ",
    });

    const { data: disciplina, error: disciplinaError } = await supabase
      .from("disciplinas_catalogo")
      .select("id,nome,sigla,area,is_core,is_avaliavel,carga_horaria_semana")
      .eq("id", parsed.data.disciplinaId).eq("escola_id", escolaId).maybeSingle();
    if (disciplinaError) throw disciplinaError;
    if (!disciplina) return NextResponse.json(
      { ok: false, error: "Disciplina não encontrada." }, { status: 404 },
    );

    const [matrixReply, legacyReply, scheduleReply] = await Promise.all([
      supabase.from("curso_matriz")
        .select("id,curso_id,classe_id,ativo,carga_horaria_semanal,obrigatoria")
        .eq("escola_id", escolaId).eq("disciplina_id", disciplina.id)
        .order("id", { ascending: true }).limit(MAX_MATRIZ + 1),
      supabase.from("turma_disciplinas_professores")
        .select("turma_id,professor_id")
        .eq("escola_id", escolaId).eq("disciplina_id", disciplina.id)
        .order("id", { ascending: true }).limit(MAX_LINKS + 1),
      supabase.from("quadro_horarios")
        .select("turma_id,professor_id,versao_id")
        .eq("escola_id", escolaId).eq("disciplina_id", disciplina.id)
        .order("id", { ascending: true }).limit(MAX_LINKS + 1),
    ]);
    if (matrixReply.error) throw matrixReply.error;
    if (legacyReply.error) throw legacyReply.error;
    if (scheduleReply.error) throw scheduleReply.error;

    const matrix = (matrixReply.data ?? []) as MatrizRow[];
    const legacy = (legacyReply.data ?? []) as LinkRow[];
    const schedule = (scheduleReply.data ?? []) as ScheduleRow[];
    let limitado = matrix.length > MAX_MATRIZ || legacy.length > MAX_LINKS || schedule.length > MAX_LINKS;
    const relevantMatrix = matrix.slice(0, MAX_MATRIZ);
    const matrixIds = relevantMatrix.map((row) => row.id);
    const publishedVersionCandidates = [...new Set(schedule.slice(0, MAX_LINKS)
      .map((row) => row.versao_id).filter((id): id is string => Boolean(id)))];
    const [directReply, versionReply] = await Promise.all([
      matrixIds.length
        ? supabase.from("turma_disciplinas")
          .select("turma_id,professor_id")
          .eq("escola_id", escolaId).in("curso_matriz_id", matrixIds)
          .order("id", { ascending: true }).limit(MAX_LINKS + 1)
        : Promise.resolve({ data: [] as LinkRow[], error: null }),
      publishedVersionCandidates.length
        ? supabase.from("horario_versoes")
          .select("id,turma_id,status")
          .eq("escola_id", escolaId)
          .in("id", publishedVersionCandidates)
        : Promise.resolve({ data: [] as Array<{ id: string; turma_id: string; status: string }>, error: null }),
    ]);
    if (directReply.error) throw directReply.error;
    if (versionReply.error) throw versionReply.error;
    const direct = (directReply.data ?? []) as LinkRow[];
    if (direct.length > MAX_LINKS) limitado = true;
    const publishedVersions = new Map(
      (versionReply.data ?? []).map((row) => [row.id, { turmaId: row.turma_id, status: row.status }] as const),
    );
    const publishedLinks = schedule.slice(0, MAX_LINKS).filter((row) =>
      row.versao_id &&
      isPublishedDisciplinaVersion(publishedVersions.get(row.versao_id)?.status) &&
      publishedVersions.get(row.versao_id)?.turmaId === row.turma_id,
    );

    const links: DisciplinaAssignment[] = [
      ...direct.slice(0, MAX_LINKS).map((row) => ({ turmaId: row.turma_id, professorId: row.professor_id })),
      ...legacy.slice(0, MAX_LINKS).map((row) => ({ turmaId: row.turma_id, professorId: row.professor_id })),
      ...publishedLinks.map((row) => ({ turmaId: row.turma_id, professorId: row.professor_id })),
    ];
    const relatedTurmaIds = [...new Set(links.map((row) => row.turmaId).filter(Boolean))];
    if (relatedTurmaIds.length > MAX_TURMAS) limitado = true;
    const requestedTurmaIds = relatedTurmaIds.slice(0, MAX_TURMAS);
    const relevantClassIds = [...new Set(relevantMatrix
      .map((row) => row.classe_id).filter((id): id is string => Boolean(id)))];
    const [turmasReply, coursesReply, classesReply, classUsageReply] = await Promise.all([
      requestedTurmaIds.length
        ? supabase.from("turmas")
          .select("id,nome,turno,ano_letivo,ano_letivo_id,classes(id,nome),cursos(id,nome)")
          .eq("escola_id", escolaId).in("id", requestedTurmaIds)
        : Promise.resolve({ data: [] as TurmaRow[], error: null }),
      relevantMatrix.some((row) => row.curso_id)
        ? supabase.from("cursos").select("id,nome").eq("escola_id", escolaId)
          .in("id", [...new Set(relevantMatrix.map((row) => row.curso_id)
            .filter((id): id is string => Boolean(id)))])
        : Promise.resolve({ data: [] as Array<{ id: string; nome: string }>, error: null }),
      relevantMatrix.some((row) => row.classe_id)
        ? supabase.from("classes").select("id,nome,ano_letivo_id").eq("escola_id", escolaId)
          .in("id", [...new Set(relevantMatrix.map((row) => row.classe_id)
            .filter((id): id is string => Boolean(id)))])
        : Promise.resolve({ data: [] as Array<{ id: string; nome: string; ano_letivo_id: string | null }>, error: null }),
      // A class may be reused across years even if its creation-year UUID is old.
      // A school-scoped turma in the requested year confirms current relevance.
      relevantClassIds.length
        ? supabase.from("turmas").select("classe_id")
          .eq("escola_id", escolaId).eq("ano_letivo_id", year.id)
          .in("classe_id", relevantClassIds).limit(MAX_TURMAS + 1)
        : Promise.resolve({ data: [] as Array<{ classe_id: string | null }>, error: null }),
    ]);
    if (turmasReply.error) throw turmasReply.error;
    if (coursesReply.error) throw coursesReply.error;
    if (classesReply.error) throw classesReply.error;
    if (classUsageReply.error) throw classUsageReply.error;
    const usedClasses = new Set((classUsageReply.data ?? [])
      .map((row) => row.classe_id).filter((id): id is string => Boolean(id)));
    if ((classUsageReply.data ?? []).length > MAX_TURMAS) limitado = true;

    const turmas: DisciplinaTurmaRow[] = ((turmasReply.data ?? []) as unknown as TurmaRow[])
      .map((row) => ({
        id: row.id, nome: row.nome, turno: row.turno,
        anoLetivo: row.ano_letivo, anoLetivoId: row.ano_letivo_id,
        classeNome: first(row.classes)?.nome ?? null,
        cursoNome: first(row.cursos)?.nome ?? null,
      })).filter((turma) => isDisciplinaTurmaInYear(turma, year));
    const scopedIds = new Set(turmas.map((turma) => turma.id));
    const teacherIds = [...new Set(links
      .filter((row) => scopedIds.has(row.turmaId))
      .map((row) => row.professorId).filter((id): id is string => Boolean(id)))];

    const teachers: DisciplinaTeacher[] = [];
    if (teacherIds.length) {
      const { data: rows, error } = await supabase.from("professores")
        .select("id,apelido,profiles(nome,deleted_at)")
        .eq("escola_id", escolaId).in("id", teacherIds);
      if (error) throw error;
      for (const teacher of (rows ?? []) as unknown as TeacherRow[]) {
        const profile = first(teacher.profiles ?? null);
        // A deleted/unreadable identity does not invalidate an academic link.
        teachers.push({
          id: teacher.id,
          nome: profile?.deleted_at
            ? "Professor com perfil desativado"
            : profile?.nome?.trim() || teacher.apelido?.trim() || "Professor com identidade indisponível",
        });
      }
    }

    const courses = new Map((coursesReply.data ?? []).map((row) => [row.id, row.nome] as const));
    const classes = new Map((classesReply.data ?? [])
      .filter((row) => isClassInAcademicYear(
        row.ano_letivo_id, year.id, usedClasses.has(row.id) ? 1 : 0,
      ))
      .map((row) => [row.id, row.nome] as const));
    const curriculo: DisciplinaCurriculumRow[] = relevantMatrix
      .filter((row) => !row.classe_id || classes.has(row.classe_id))
      .map((row) => ({
        id: row.id,
        cursoId: row.curso_id && courses.has(row.curso_id) ? row.curso_id : null,
        cursoNome: row.curso_id ? courses.get(row.curso_id) ?? null : null,
        classeId: row.classe_id && classes.has(row.classe_id) ? row.classe_id : null,
        classeNome: row.classe_id ? classes.get(row.classe_id) ?? null : null,
        cargaHorariaSemanal: row.carga_horaria_semanal,
        obrigatoria: row.obrigatoria,
        ativo: row.ativo,
      }));
    const overview = composeDisciplinaOverview({
      turmas, assignments: links, teachers, curriculum: curriculo, academicYear: year,
    });
    return NextResponse.json({
      ok: true,
      data: {
        disciplina: {
          id: disciplina.id, nome: disciplina.nome, sigla: disciplina.sigla,
          area: disciplina.area, isCore: disciplina.is_core,
          isAvaliavel: disciplina.is_avaliavel, cargaHorariaReferencia: disciplina.carga_horaria_semana,
        },
        anoLetivo: { id: year.id, ano: year.ano, historico: year.status === "CLOSED" },
        ...overview,
        limitado,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AcademicYearContextError) return NextResponse.json(
      { ok: false, error: error.message }, { status: error.status },
    );
    return NextResponse.json(
      { ok: false, error: "Não foi possível carregar esta disciplina." }, { status: 500 },
    );
  }
}

/** Stable envelope and PII-free correlation across success, 4xx and 5xx. */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; disciplinaId: string }> },
) {
  return withExplorerObservability("disciplina", () => readExplorer(req, context));
}
