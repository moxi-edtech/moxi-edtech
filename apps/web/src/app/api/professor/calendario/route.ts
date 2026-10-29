import { NextResponse } from "next/server";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { CanonicalPeriodReadError, verifyCanonicalPeriodsRead } from "@/lib/academico/verify-canonical-periods-read";
import {
  CalendarEventScopeError,
  readScopedAcademicCalendarEvents,
  resolveCalendarOfferingIdsForCourses,
} from "@/lib/academico/calendar-events-read";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type ProfessorRow = { id: string };
type AnoLetivoRow = {
  id: string;
  ano: number | null;
  ativo: boolean | null;
  data_inicio: string;
  data_fim: string;
};
type PeriodoRow = {
  id: string;
  ano_letivo_id: string;
  tipo: string | null;
  numero: number | null;
  data_inicio: string;
  data_fim: string;
  trava_notas_em: string | null;
  peso: number | null;
  offering_id: string | null;
  source_template_id: string | null;
  source_item_id: string | null;
  source_version: string | null;
};
type EventoRow = {
  id: string;
  escola_id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  publico_alvo: string | null;
  cor_hex: string | null;
  offering_id?: string | null;
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
    }

    const professorResult = await applyKf2ListInvariants(
      supabase
        .from("professores")
        .select("id")
        .eq("profile_id", user.id)
        .eq("escola_id", escolaId),
      { defaultLimit: 1, tieBreakerColumn: "id" }
    ).maybeSingle();
    const professor = (professorResult.data as ProfessorRow | null) ?? null;

    if (!professor?.id) {
      return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 403 });
    }

    const academicContext = await resolveAcademicYearContext(supabase as any, {
      userId: user.id,
      requestedAcademicYearId: new URL(req.url).searchParams.get("ano_letivo_id"),
      operation: "READ",
    });

    const activeYearQuery = applyKf2ListInvariants(
      supabase
        .from("anos_letivos")
        .select("id, ano, ativo, data_inicio, data_fim")
        .eq("escola_id", escolaId)
        .eq("id", academicContext.anoLetivoId),
      {
        defaultLimit: 1,
        order: [{ column: "ano", ascending: false }],
        tieBreakerColumn: "id",
      }
    );

    const activeYearResult = await activeYearQuery.maybeSingle();
    let anoLetivo = (activeYearResult.data as AnoLetivoRow | null) ?? null;
    let anoLetivoError = activeYearResult.error ?? null;

    if (anoLetivoError) {
      return NextResponse.json({ ok: false, error: anoLetivoError.message }, { status: 400 });
    }

    const today = new Date();
    const rangeStart = anoLetivo?.data_inicio ?? toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const rangeEnd =
      anoLetivo?.data_fim ?? toIsoDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()));

    // A teacher is authorized for their explicitly assigned disciplines,
    // including shared teachers, or an assigned class-director relationship.
    // Never infer ownership from arbitrary turma query parameters.
    const [{ data: sharedLinks, error: sharedError },
      { data: primaryLinks, error: primaryError },
      { data: directedClasses, error: directedError }] = await Promise.all([
      supabase.from("turma_disciplinas_professores")
        .select("turma_id").eq("escola_id", escolaId)
        .eq("professor_id", professor.id).limit(1000),
      supabase.from("turma_disciplinas")
        .select("turma_id").eq("escola_id", escolaId)
        .eq("professor_id", professor.id).limit(1000),
      supabase.from("turmas").select("id,curso_id")
        .eq("escola_id", escolaId).eq("ano_letivo_id", academicContext.anoLetivoId)
        .eq("diretor_turma_id", professor.id).limit(200),
    ]);
    if (sharedError || primaryError || directedError) {
      throw sharedError ?? primaryError ?? directedError;
    }
    if ((sharedLinks ?? []).length >= 1000 || (primaryLinks ?? []).length >= 1000 ||
      (directedClasses ?? []).length >= 200) {
      return NextResponse.json({
        ok: false, code: "CALENDAR_ASSIGNMENT_LIMIT_REACHED",
        error: "Existem atribuições a mais para resolver este calendário com segurança.",
      }, { status: 409 });
    }
    const turmaIds = [...new Set([
      ...(sharedLinks ?? []).map((link: { turma_id: string }) => link.turma_id),
      ...(primaryLinks ?? []).map((link: { turma_id: string }) => link.turma_id),
    ])];
    const { data: linkedClasses, error: classError } = turmaIds.length
      ? await supabase.from("turmas").select("id,curso_id")
          .eq("escola_id", escolaId)
          .eq("ano_letivo_id", academicContext.anoLetivoId)
          .in("id", turmaIds).limit(1000)
      : { data: [], error: null };
    if (classError) throw classError;
    if ((linkedClasses ?? []).length >= 1000) {
      return NextResponse.json({
        ok: false, code: "CALENDAR_ASSIGNMENT_LIMIT_REACHED",
        error: "O calendário do professor precisa de revisão das atribuições.",
      }, { status: 409 });
    }
    const teacherClasses = [...(linkedClasses ?? []), ...(directedClasses ?? [])];
    if (teacherClasses.some((row: { curso_id: string | null }) => !row.curso_id)) {
      return NextResponse.json({
        ok: false, code: "CALENDAR_COURSE_NOT_MAPPED",
        error: "Uma das turmas atribuídas não possui curso associado.",
      }, { status: 409 });
    }
    const courseIds = [...new Set(teacherClasses.map((row: { curso_id: string }) => row.curso_id))];
    const offeringIds = await resolveCalendarOfferingIdsForCourses(supabase, {
      escolaId, cursoIds: courseIds,
    });

    const [academicEvents, { data: genericEvents, error: genericError }] = await Promise.all([
      readScopedAcademicCalendarEvents(supabase, {
        escolaId,
        anoLetivoId: academicContext.anoLetivoId,
        offeringIds,
        rangeStart, rangeEnd,
        columns: "id,escola_id,nome,data_inicio,data_fim,tipo,cor_hex,offering_id",
        limit: 200,
      }),
      supabase.from("events")
        .select("id,escola_id,titulo,descricao,inicio_at,fim_at,publico_alvo")
        .eq("escola_id", escolaId)
        .or("publico_alvo.eq.todos,publico_alvo.eq.professores,publico_alvo.is.null")
        .lte("inicio_at", rangeEnd)
        .order("inicio_at", { ascending: false }).limit(500),
    ]);
    if (genericError) throw genericError;
    const genericItems: EventoRow[] = (genericEvents ?? [])
      .filter((event: any) => {
        const start = String(event.inicio_at ?? "").slice(0, 10);
        const end = String(event.fim_at ?? event.inicio_at ?? "").slice(0, 10);
        return start <= rangeEnd && end >= rangeStart;
      }).map((event: any) => ({
        id: event.id, escola_id: event.escola_id,
        nome: event.titulo, descricao: event.descricao,
        data_inicio: String(event.inicio_at).slice(0, 10),
        data_fim: String(event.fim_at ?? event.inicio_at).slice(0, 10),
        tipo: "EVENTO_GERAL", publico_alvo: event.publico_alvo, cor_hex: "#64748b",
        offering_id: null,
      }));
    const calendarItems: EventoRow[] = (academicEvents as Array<{
      id: string; escola_id: string; nome: string; data_inicio: string;
      data_fim: string; tipo: string; cor_hex: string | null; offering_id: string | null;
    }>).map((event) => ({
      ...event, descricao: "Evento do Calendário Académico", publico_alvo: "todos",
    }));
    const items: EventoRow[] = [...genericItems, ...calendarItems]
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio) || a.id.localeCompare(b.id))
      .slice(0, 120);

    const periodosPromise = anoLetivo?.id
      ? applyKf2ListInvariants(
          supabase
            .from("periodos_letivos")
            .select("id, ano_letivo_id, tipo, numero, data_inicio, data_fim, trava_notas_em, peso, offering_id, source_template_id, source_item_id, source_version")
            .eq("escola_id", escolaId)
            .eq("ano_letivo_id", anoLetivo.id),
          {
            defaultLimit: 20,
            order: [{ column: "data_inicio", ascending: true }],
            tieBreakerColumn: "id",
          }
        )
      : Promise.resolve({ data: [] as PeriodoRow[], error: null });

    const { data: periodos, error: periodosError } = await periodosPromise;

    if (periodosError) {
      return NextResponse.json({ ok: false, error: periodosError.message }, { status: 400 });
    }

    await verifyCanonicalPeriodsRead(supabase, {
      escolaId, anoLetivoId: academicContext.anoLetivoId,
      yearBase: Number(academicContext.anoLetivoLabel.split("/")[0]),
      periods: (periodos ?? []) as PeriodoRow[],
    });

    return NextResponse.json({
      ok: true,
      context: academicContext,
      ano_letivo: anoLetivo ?? null,
      periodos: ((periodos as PeriodoRow[] | null) ?? [])
        .filter(Boolean)
        .map(({ id, ano_letivo_id, tipo, numero, data_inicio, data_fim, trava_notas_em, peso }) =>
          ({ id, ano_letivo_id, tipo, numero, data_inicio, data_fim, trava_notas_em, peso })),
      items,
    });
  } catch (err) {
    if (err instanceof CanonicalPeriodReadError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.status });
    }
    if (err instanceof CalendarEventScopeError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message },
        { status: err.code === "CALENDAR_INVALID_SCOPE" ? 400 : 409 });
    }
    if (err instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: err.code, message: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
