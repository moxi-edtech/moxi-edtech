import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";
import {
  CalendarEventScopeError,
  readScopedAcademicCalendarEvents,
  resolveCalendarOfferingForCourse,
} from "@/lib/academico/calendar-events-read";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const url = new URL(req.url);
    const requestedEscolaId = url.searchParams.get("escolaId") || url.searchParams.get("escola_id");
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
    });
    if (roleError) return roleError;

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: url.searchParams.get("ano_letivo_id"),
      operation: "READ",
    });

    const requestedYearId = academicContext.anoLetivoId;
    const yearsQuery = supabase
      .from("anos_letivos")
      .select("id, ano, ativo, data_inicio, data_fim")
      .eq("escola_id", escolaId)
      .order("ano", { ascending: false })
      .limit(20);
    const { data: years, error: yearsError } = await yearsQuery;
    if (yearsError) return NextResponse.json({ ok: false, error: yearsError.message }, { status: 400 });

    const selectedYear = (years ?? []).find((year: any) => year.id === requestedYearId);
    if (!selectedYear) return NextResponse.json({ ok: true, items: [], anos_letivos: years ?? [], ano_letivo: null });

    const rangeStart = String(selectedYear.data_inicio);
    const rangeEnd = String(selectedYear.data_fim);

    // This route already requires a secretaria role. When no course is
    // selected, the staff-only overview must label every scoped event
    // explicitly instead of treating it as applicable to all students.
    const selectedCourseId = url.searchParams.get("curso_id");
    const { data: courseOfferings, error: offeringsError } = await supabase
      .from("school_education_offerings")
      .select("id,course_id,education_subsystem")
      .eq("escola_id", escolaId)
      .eq("status", "active")
      .limit(500);
    if (offeringsError) throw offeringsError;
    if ((courseOfferings ?? []).length >= 500) {
      return NextResponse.json({
        ok: false, code: "CALENDAR_OFFERING_LIMIT_REACHED",
        error: "É necessário rever o catálogo de ofertas educativas para consultar o calendário.",
      }, { status: 409 });
    }
    const courseIds = [...new Set((courseOfferings ?? [])
      .map((offering: any) => offering.course_id).filter(Boolean))] as string[];
    const { data: courses, error: coursesError } = courseIds.length
      ? await supabase.from("cursos").select("id,nome").eq("escola_id", escolaId).in("id", courseIds)
      : { data: [], error: null };
    if (coursesError) throw coursesError;
    const names = new Map<string, string>((courses ?? [])
      .map((course: any) => [String(course.id), String(course.nome)] as const));
    const courseOptions = (courseOfferings ?? [])
      .filter((offering: any) => offering.course_id)
      .map((offering: any) => ({
        course_id: String(offering.course_id),
        offering_id: String(offering.id),
        nome: names.get(String(offering.course_id)) ?? "Curso",
        subsistema: offering.education_subsystem,
      }));
    let selectedOfferingIds: string[] = [];
    if (selectedCourseId) {
      selectedOfferingIds = [await resolveCalendarOfferingForCourse(supabase, {
        escolaId, cursoId: selectedCourseId,
      })];
    }
    const offeringLabels = new Map<string, string>(
      courseOptions.map((option: any) => [option.offering_id, option.nome]),
    );
    const [genericResult, academicEvents] = await Promise.all([
      supabase
        .from("events")
        .select("id, escola_id, titulo, descricao, inicio_at, fim_at, publico_alvo")
        .eq("escola_id", escolaId),
      readScopedAcademicCalendarEvents(supabase, {
        escolaId,
        anoLetivoId: selectedYear.id,
        offeringIds: selectedOfferingIds,
        staffOverview: !selectedCourseId,
        rangeStart, rangeEnd,
        limit: 500,
        columns: "id,escola_id,nome,data_inicio,data_fim,tipo,cor_hex,offering_id",
      }),
    ]);
    const { data: genericEvents, error: genericError } = genericResult;
    if (genericError) {
      return NextResponse.json({ ok: false, error: genericError.message }, { status: 400 });
    }
    const scopedAcademicEvents = academicEvents as Array<{
      id: string; escola_id: string; nome: string; data_inicio: string;
      data_fim: string; tipo: string; cor_hex: string | null; offering_id: string | null;
    }>;

    const startMs = new Date(rangeStart).getTime();
    const endMs = new Date(rangeEnd).getTime();
    const items = [
      ...(genericEvents ?? [])
        .filter((event: any) => {
          const start = new Date(event.inicio_at).getTime();
          const end = new Date(event.fim_at ?? event.inicio_at).getTime();
          return start <= endMs && end >= startMs;
        })
        .map((event: any) => ({
          id: event.id,
          escola_id: event.escola_id,
          nome: event.titulo,
          descricao: event.descricao,
          data_inicio: event.inicio_at,
          data_fim: event.fim_at ?? event.inicio_at,
          tipo: "EVENTO_GERAL",
          publico_alvo: event.publico_alvo,
          cor_hex: "#64748b",
        })),
      ...scopedAcademicEvents.map((event) => ({
        id: event.id,
        escola_id: event.escola_id,
        nome: event.nome,
        descricao: event.offering_id
          ? `Evento do calendário · ${offeringLabels.get(event.offering_id) ?? "Curso identificado"}`
          : "Evento geral do calendário académico",
        data_inicio: event.data_inicio,
        data_fim: event.data_fim,
        tipo: event.tipo,
        publico_alvo: event.offering_id ? "curso" : "todos",
        cor_hex: event.cor_hex,
        offering_id: event.offering_id,
        curso_nome: event.offering_id ? offeringLabels.get(event.offering_id) ?? "Curso" : null,
      })),
    ].sort((a, b) => String(a.data_inicio).localeCompare(String(b.data_inicio)));

    const limitedItems = items.slice(0, 300);
    return NextResponse.json({
      ok: true,
      items: limitedItems,
      anos_letivos: years ?? [],
      ano_letivo: selectedYear,
      course_offerings: courseOptions,
      selected_course_id: selectedCourseId,
      context: academicContext,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof CalendarEventScopeError) {
      return NextResponse.json({ ok: false, error: e.message, code: e.code },
        { status: e.code === "CALENDAR_INVALID_SCOPE" ? 400 : 409 });
    }
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const url = new URL(req.url);
    const requestedEscolaId = url.searchParams.get("escolaId") || url.searchParams.get("escola_id");
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
    });
    if (roleError) return roleError;

    const body = await req.json();
    const { titulo, descricao, inicio_at, fim_at, publico_alvo, ano_letivo_id } = body;

    if (!titulo || !inicio_at) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: ano_letivo_id,
      operation: "WRITE",
    });

    const { data: newEvent, error } = await supabase
      .from('events')
      .insert({
        titulo,
        descricao,
        inicio_at,
        fim_at,
        publico_alvo: publico_alvo || "todos",
        escola_id: escolaId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, context: academicContext, data: newEvent });

  } catch (e) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
