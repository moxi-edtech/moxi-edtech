import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { AcademicYearContextError } from "@/lib/academic-year/context";
import { schoolCalendarDate } from "@/lib/academico/grade-period-context";
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
    if (matricula?.turma_id) {
      const { data: turma, error: turmaError } = await supabase
        .from("turmas")
        .select("curso_id")
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
    }

    const events = await readScopedAcademicCalendarEvents(supabase, {
      escolaId: ctx.escolaId,
      anoLetivoId: context.anoLetivoId,
      offeringIds,
      rangeStart: schoolCalendarDate(new Date(), context.timezone),
      limit: 3,
    });

    return NextResponse.json({ ok: true, items: events }, {
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
