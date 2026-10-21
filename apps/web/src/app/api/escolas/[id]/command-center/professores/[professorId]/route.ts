import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";
import {
  belongsToProfessorAcademicYear, composeProfessorOverview, isPublishedTimetableVersion,
  type ProfessorAllocation, type ProfessorScheduleRow, type ProfessorTurmaRow,
} from "@/lib/command-center/professor-explorer";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  escolaId: z.string().uuid(),
  professorId: z.string().uuid(),
  anoLetivoId: z.string().uuid().nullable(),
});

// Hard cap prevents uncontrolled fan-out. The response marks partial results as incomplete.
const MAX_ASSIGNMENTS = 500;

type TurmaRow = {
  id: string; nome: string; turno: string | null; ano_letivo: number | null;
  ano_letivo_id: string | null;
  classes: { id: string; nome: string } | { id: string; nome: string }[] | null;
  cursos: { id: string; nome: string } | { id: string; nome: string }[] | null;
};
type DirectLink = { turma_id: string; curso_matriz_id: string | null };
type LegacyLink = { turma_id: string; disciplina_id: string | null };
type TimetableLink = {
  turma_id: string; disciplina_id: string | null;
  slot_id: string | null; versao_id: string | null;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Academic read-only detail. Search result, URL, client role and teacher name
 * are never treated as authorization. No BI, email, payroll, contacts or grades.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; professorId: string }> },
) {
  const { id: requestedSchoolId, professorId } = await params;
  const parsed = requestSchema.safeParse({
    escolaId: requestedSchoolId,
    professorId,
    anoLetivoId: new URL(req.url).searchParams.get("ano_letivo_id"),
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
    const authz = await requireRoleInSchool({
      supabase, escolaId, productContext: "k12",
      roles: ["admin", "admin_escola", "staff_admin", "diretor",
        "secretaria", "admin_secretaria", "secretaria_financeiro", "admin_financeiro"],
    });
    if (authz.error) return authz.error;

    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: parsed.data.anoLetivoId, operation: "READ",
    });

    const { data: professor, error: teacherError } = await supabase
      .from("professores")
      .select("id,apelido,profile_id")
      .eq("id", parsed.data.professorId)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (teacherError) throw teacherError;
    if (!professor) return NextResponse.json(
      { ok: false, error: "Professor não encontrado." }, { status: 404 },
    );

    let nome = professor.apelido?.trim() || "Professor";
    if (professor.profile_id) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("nome,deleted_at")
        .eq("user_id", professor.profile_id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (profile?.deleted_at) return NextResponse.json(
        { ok: false, error: "Professor não encontrado." }, { status: 404 },
      );
      if (profile?.nome?.trim()) nome = profile.nome.trim();
    }

    const [directReply, legacyReply, scheduleReply] = await Promise.all([
      supabase.from("turma_disciplinas")
        .select("turma_id,curso_matriz_id")
        .eq("escola_id", escolaId).eq("professor_id", professor.id)
        .order("id", { ascending: true }).limit(MAX_ASSIGNMENTS + 1),
      supabase.from("turma_disciplinas_professores")
        .select("turma_id,disciplina_id")
        .eq("escola_id", escolaId).eq("professor_id", professor.id)
        .order("id", { ascending: true }).limit(MAX_ASSIGNMENTS + 1),
      supabase.from("quadro_horarios")
        .select("turma_id,disciplina_id,slot_id,versao_id")
        .eq("escola_id", escolaId).eq("professor_id", professor.id)
        .order("id", { ascending: true }).limit(MAX_ASSIGNMENTS + 1),
    ]);
    if (directReply.error) throw directReply.error;
    if (legacyReply.error) throw legacyReply.error;
    if (scheduleReply.error) throw scheduleReply.error;

    const direct = (directReply.data ?? []) as DirectLink[];
    const legacy = (legacyReply.data ?? []) as LegacyLink[];
    const schedule = (scheduleReply.data ?? []) as TimetableLink[];
    const partial = [direct, legacy, schedule].some((items) => items.length > MAX_ASSIGNMENTS);
    const directWindow = direct.slice(0, MAX_ASSIGNMENTS);
    const legacyWindow = legacy.slice(0, MAX_ASSIGNMENTS);
    const scheduleWindow = schedule.slice(0, MAX_ASSIGNMENTS);

    const relatedTurmaIds = [...new Set([
      ...directWindow.map((item) => item.turma_id),
      ...legacyWindow.map((item) => item.turma_id),
      ...scheduleWindow.map((item) => item.turma_id),
    ].filter(Boolean))];

    if (!relatedTurmaIds.length) {
      return NextResponse.json({ ok: true, data: {
        professor: { id: professor.id, nome },
        anoLetivo: { id: year.id, ano: year.ano, historico: year.status === "CLOSED" },
        turmas: [], disciplinas: [], horarios: [],
        stats: { turmas: 0, disciplinas: 0, aulasPublicadas: 0 },
        limitado: false,
      } }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const { data: turmaRows, error: turmaError } = await supabase.from("turmas")
      .select("id,nome,turno,ano_letivo,ano_letivo_id,classes(id,nome),cursos(id,nome)")
      .eq("escola_id", escolaId)
      .in("id", relatedTurmaIds);
    if (turmaError) throw turmaError;
    const scoped = ((turmaRows ?? []) as unknown as TurmaRow[]).map((turma): ProfessorTurmaRow => ({
      id: turma.id,
      nome: turma.nome,
      turno: turma.turno,
      anoLetivo: turma.ano_letivo,
      anoLetivoId: turma.ano_letivo_id,
      classeNome: first(turma.classes)?.nome ?? null,
      cursoNome: first(turma.cursos)?.nome ?? null,
    })).filter((turma) => belongsToProfessorAcademicYear(turma, year));
    const scopedIds = new Set(scoped.map((turma) => turma.id));

    const matrixIds = [...new Set(directWindow
      .filter((d) => scopedIds.has(d.turma_id) && d.curso_matriz_id)
      .map((d) => d.curso_matriz_id!))];
    const matrixSubjects = new Map<string, string>();
    if (matrixIds.length) {
      const { data: matrixRows, error: matrixError } = await supabase.from("curso_matriz")
        .select("id,disciplina_id")
        .eq("escola_id", escolaId).in("id", matrixIds);
      if (matrixError) throw matrixError;
      for (const row of matrixRows ?? []) if (row.disciplina_id) {
        matrixSubjects.set(row.id, row.disciplina_id);
      }
    }

    const allocations: ProfessorAllocation[] = [
      ...directWindow.filter((d) => scopedIds.has(d.turma_id)).map((d) => ({
        turmaId: d.turma_id,
        disciplinaId: d.curso_matriz_id ? matrixSubjects.get(d.curso_matriz_id) ?? null : null,
      })),
      ...legacyWindow.filter((d) => scopedIds.has(d.turma_id)).map((d) => ({
        turmaId: d.turma_id, disciplinaId: d.disciplina_id,
      })),
    ];

    // Only an explicitly published version is a real timetable. Drafts and
    // archived versions must not be presented as teaching commitments.
    const versions = new Map<string, { turma_id: string; status: string }>();
    const versionIds = [...new Set(scheduleWindow
      .filter((s) => scopedIds.has(s.turma_id) && s.versao_id)
      .map((s) => s.versao_id!))];
    if (versionIds.length) {
      const { data, error } = await supabase.from("horario_versoes")
        .select("id,turma_id,status")
        .eq("escola_id", escolaId).in("id", versionIds);
      if (error) throw error;
      for (const version of data ?? []) versions.set(version.id, version);
    }
    const published = scheduleWindow.filter((s) =>
      scopedIds.has(s.turma_id) &&
      isPublishedTimetableVersion(s.versao_id ? versions.get(s.versao_id)?.status : null) &&
      versions.get(s.versao_id!)?.turma_id === s.turma_id &&
      Boolean(s.slot_id),
    );

    const slots = new Map<string, { dia_semana: number; inicio: string; fim: string }>();
    const slotIds = [...new Set(published.map((s) => s.slot_id!))];
    if (slotIds.length) {
      const { data, error } = await supabase.from("horario_slots")
        .select("id,dia_semana,inicio,fim")
        .eq("escola_id", escolaId).eq("is_intervalo", false).in("id", slotIds);
      if (error) throw error;
      for (const slot of data ?? []) slots.set(slot.id, slot);
    }

    const timetable: ProfessorScheduleRow[] = published.flatMap((link) => {
      const slot = link.slot_id ? slots.get(link.slot_id) : null;
      if (!slot || !link.slot_id) return [];
      return [{
        turmaId: link.turma_id, disciplinaId: link.disciplina_id,
        slotId: link.slot_id, diaSemana: slot.dia_semana,
        inicio: slot.inicio, fim: slot.fim,
      }];
    });

    const subjectIds = [...new Set([
      ...allocations.map((a) => a.disciplinaId),
      ...timetable.map((t) => t.disciplinaId),
    ].filter((id): id is string => Boolean(id)))];
    const subjects: Array<{ id: string; nome: string }> = [];
    if (subjectIds.length) {
      const { data: rows, error } = await supabase.from("disciplinas_catalogo")
        .select("id,nome").eq("escola_id", escolaId).in("id", subjectIds);
      if (error) throw error;
      subjects.push(...(rows ?? []));
    }

    const overview = composeProfessorOverview({ turmas: scoped, allocations, schedule: timetable, subjects });
    return NextResponse.json({
      ok: true,
      data: {
        professor: { id: professor.id, nome },
        anoLetivo: { id: year.id, ano: year.ano, historico: year.status === "CLOSED" },
        ...overview,
        limitado: partial,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AcademicYearContextError) return NextResponse.json(
      { ok: false, error: error.message }, { status: error.status },
    );
    console.error("[command-center/professor] read failed", error instanceof Error ? error.message : "unexpected");
    return NextResponse.json(
      { ok: false, error: "Não foi possível carregar o professor." }, { status: 500 },
    );
  }
}
