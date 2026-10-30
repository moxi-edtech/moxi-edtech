import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { AcademicYearContextError } from "@/lib/academic-year/context";
import { schoolCalendarDate } from "@/lib/academico/grade-period-context";
import { selectApplicableOfficialEvents } from "@/lib/academic-calendar/visible-official-events";
import {
  CalendarEventScopeError,
  readScopedAcademicCalendarEvents,
  resolveCalendarOfferingForCourse,
} from "@/lib/academico/calendar-events-read";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const params = new URL(req.url).searchParams;
    const requestedId = params.get("studentId");
    if (requestedId && !ctx.alunoIds.includes(requestedId)) {
      return NextResponse.json({ ok: false, error: "Aluno não autorizado." }, { status: 403 });
    }
    const alunoId = resolveSelectedStudentId({
      selectedId: requestedId, authorizedIds: ctx.alunoIds, fallbackId: ctx.alunoId,
    });
    if (!alunoId) {
      return NextResponse.json({ ok: true, items: [] }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Read the exact enrolled student's original academic year. An account
    // can manage multiple children; never reuse another child's turmaId.
    const { matricula, context } = await resolveBoletimMatricula(supabase, {
      escolaId: ctx.escolaId,
      alunoId,
      userId: ctx.userId,
      anoLetivoId: params.get("ano_letivo_id"),
      operation: "READ",
    });

    let offeringIds: string[] = [];
    let turmaGrade: string | null = null;
    let isExamClass = false;
    let calendarProfileId: string | null = null;
    if (matricula?.turma_id) {
      const { data: turma, error: turmaError } = await supabase
        .from("turmas")
        .select("curso_id,classe_num,is_classe_exame")
        .eq("id", matricula.turma_id)
        .eq("escola_id", ctx.escolaId)
        .eq("ano_letivo_id", context.anoLetivoId)
        .maybeSingle();
      if (turmaError) throw turmaError;
      if (!turma) {
        return NextResponse.json({
          ok: false, code: "CALENDAR_TURMA_NOT_FOUND",
          error: "Não foi possível confirmar a turma do aluno neste ano letivo.",
        }, { status: 409 });
      }
      if (!turma.curso_id) {
        return NextResponse.json({
          ok: false, code: "CALENDAR_COURSE_NOT_MAPPED",
          error: "A turma precisa de um curso para apresentar o calendário académico.",
        }, { status: 409 });
      }
      offeringIds = [await resolveCalendarOfferingForCourse(supabase, {
        escolaId: ctx.escolaId, cursoId: turma.curso_id,
      })];
      turmaGrade = turma.classe_num == null ? null : String(turma.classe_num);
      isExamClass = turma.is_classe_exame === true;
      const { data: offering, error: offeringError } = await supabase
        .from("school_education_offerings")
        .select("calendar_profile_id")
        .eq("escola_id", ctx.escolaId)
        .eq("course_id", turma.curso_id)
        .eq("id", offeringIds[0])
        .eq("status", "active")
        .maybeSingle();
      if (offeringError) throw offeringError;
      calendarProfileId = offering?.calendar_profile_id ?? null;
    }

    const yearBase = Number(context.anoLetivoLabel.split("/")[0]);
    if (yearBase >= 2026 && (!matricula?.turma_id || !calendarProfileId)) {
      return NextResponse.json({
        ok: false, code: "CALENDAR_COURSE_NOT_MAPPED",
        error: "A turma precisa de um perfil do calendário oficial para apresentar as provas.",
      }, { status: 409 });
    }

    if (yearBase >= 2026) {
      const { data: profile, error: profileError } = await supabase
        .from("calendario_templates")
        .select("id")
        .eq("id", calendarProfileId!)
        .eq("ano_base", yearBase)
        .eq("is_oficial", true)
        .eq("estado", "PUBLICADO")
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        return NextResponse.json({
          ok: false, code: "OFFICIAL_CALENDAR_NOT_RECONCILED",
          error: "O perfil do curso não corresponde ao calendário publicado deste ano.",
        }, { status: 409 });
      }
    }

    const events = await readScopedAcademicCalendarEvents<{
      id: string; nome: string; tipo: string;
      data_inicio: string; data_fim: string;
      offering_id: string | null; source_template_id: string | null;
    }>(supabase, {
      escolaId: ctx.escolaId,
      anoLetivoId: context.anoLetivoId,
      offeringIds,
      rangeStart: schoolCalendarDate(new Date(), context.timezone),
      limit: yearBase >= 2026 ? 500 : 3,
    });

    let visible = events;
    if (yearBase >= 2026 && calendarProfileId) {
      const { data: officialItems, error: itemsError } = await supabase
        .from("calendario_template_items")
        .select("nome,tipo,data_inicio,data_fim,applies_to_all_offerings,grade_codes")
        .eq("template_id", calendarProfileId)
        .neq("tipo", "PERIODO_LETIVO")
        .limit(500);
      if (itemsError) throw itemsError;
      if (events.length >= 500 || (officialItems?.length ?? 0) >= 500) {
        return NextResponse.json({
          ok: false, code: "ACADEMIC_CALENDAR_RESULT_LIMIT",
          error: "Existem demasiados eventos para confirmar o calendário deste curso.",
        }, { status: 409 });
      }
      const scopedOfficialEvents = selectApplicableOfficialEvents(
        events.filter((event) => Boolean(event.source_template_id)),
        officialItems ?? [], offeringIds, turmaGrade, isExamClass,
      );
      const officialIds = new Set(scopedOfficialEvents.map((event) => event.id));
      visible = events.filter((event) =>
        officialIds.has(event.id) ||
        (!event.source_template_id && event.tipo === "EVENTO_GERAL"));
    }

    return NextResponse.json({ ok: true, items: visible.slice(0, 3) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause: unknown) {
    if (cause instanceof AcademicYearContextError) {
      return NextResponse.json({
        ok: false, error: cause.message, code: cause.code,
      }, { status: cause.status });
    }
    if (cause instanceof CalendarEventScopeError) {
      return NextResponse.json({
        ok: false, error: cause.message, code: cause.code,
      }, { status: cause.code === "CALENDAR_INVALID_SCOPE" ? 400 : 409 });
    }
    return NextResponse.json({
      ok: false, error: "Não foi possível consultar os eventos académicos.",
    }, { status: 503 });
  }
}
