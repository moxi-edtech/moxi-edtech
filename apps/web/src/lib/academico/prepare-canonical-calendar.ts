import { NextResponse } from "next/server";
import {
  buildCanonicalMedCalendarPlan,
  buildCanonicalMedCalendarSkeleton,
  CanonicalCalendarError,
  type CanonicalMedCalendar,
  type MedCourseProfile,
  type MedCourseOffering,
  type CourseCalendarSelection,
} from "./canonical-med-calendar";

/** Official year operation; all reads/validations precede the first write. */
export async function prepareCanonicalMedCalendar(input: {
  db: any;
  escolaId: string;
  userId: string;
  anoBase: number;
  selections?: CourseCalendarSelection[];
  allowEmptyOfferings?: boolean;
}) {
  const { db, escolaId, anoBase } = input;
  const [calendarResult, profilesResult, offeringsResult, activeYearResult] = await Promise.all([
    db.from("calendarios_oficiais_anos").select("ano_base,data_inicio,data_fim,versao_documento,estado")
      .eq("ano_base", anoBase).eq("estado", "PUBLICADO").maybeSingle(),
    db.from("calendario_templates")
      .select("id,ano_base,calendario_canonico_ano,subsistema,data_inicio,data_fim,is_oficial,estado,versao_documento,items:calendario_template_items(*)")
      .eq("calendario_canonico_ano", anoBase).eq("is_oficial", true).eq("estado", "PUBLICADO"),
    db.from("school_education_offerings")
      .select("id,course_id,education_subsystem,education_level,cycle,grades,calendar_profile_id")
      .eq("escola_id", escolaId).eq("status", "active"),
    db.from("anos_letivos").select("id,ano,ativo,data_inicio,data_fim")
      .eq("escola_id", escolaId).eq("ativo", true).maybeSingle(),
  ]);
  for (const result of [calendarResult, profilesResult, offeringsResult, activeYearResult]) {
    if (result.error) throw result.error;
  }
  const calendar = calendarResult.data as CanonicalMedCalendar | null;
  if (!calendar) {
    return NextResponse.json({
      ok: false, code: "OFFICIAL_CALENDAR_NOT_PUBLISHED",
      error: "O calendário oficial deste ano letivo ainda não foi publicado.",
    }, { status: 409 });
  }
  if (activeYearResult.data && anoBase < activeYearResult.data.ano) {
    return NextResponse.json({
      ok: false, code: "ACADEMIC_YEAR_IN_THE_PAST",
      error: "O calendário deve pertencer ao ano atual ou a um ano futuro.",
    }, { status: 409 });
  }

  const offerings = (offeringsResult.data ?? []) as MedCourseOffering[];
  const ids = offerings.map((item) => item.course_id).filter((value): value is string => Boolean(value));
  const courseTypeById = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: courses, error } = await db.from("cursos")
      .select("id,tipo").eq("escola_id", escolaId).in("id", ids);
    if (error) throw error;
    for (const course of courses ?? []) courseTypeById.set(course.id, course.tipo);
  }
  const enrichedOfferings = offerings.map((offering) => ({
    ...offering, course_type: offering.course_id ? courseTypeById.get(offering.course_id) ?? null : null,
  }));

  // By default reuse the school's already installed course/profile bindings
  // if they belong to the requested year. Never select a foreign profile.
  const selections = input.selections ?? offerings.map((offering) => ({
    offering_id: offering.id,
    template_id: String((offering as MedCourseOffering & { calendar_profile_id?: string }).calendar_profile_id ?? ""),
  }));
  let plan: ReturnType<typeof buildCanonicalMedCalendarPlan>;
  try {
    // The initial onboarding step precedes course installation. Create only
    // the canonical year/terms, then apply course events during finalization.
    plan = offerings.length === 0 && input.allowEmptyOfferings
      ? buildCanonicalMedCalendarSkeleton({
          calendar, profiles: (profilesResult.data ?? []) as MedCourseProfile[],
        })
      : buildCanonicalMedCalendarPlan({
      calendar,
      profiles: (profilesResult.data ?? []) as MedCourseProfile[],
      offerings: enrichedOfferings,
      selections,
    });
  } catch (cause) {
    if (cause instanceof CanonicalCalendarError) {
      return NextResponse.json({ ok: false, code: cause.code, error: cause.message }, { status: 409 });
    }
    throw cause;
  }

  const { data: existingYear, error: yearError } = await db.from("anos_letivos")
    .select("id,ano,ativo,data_inicio,data_fim")
    .eq("escola_id", escolaId).eq("ano", anoBase).maybeSingle();
  if (yearError) throw yearError;
  if (existingYear && (existingYear.data_inicio !== calendar.data_inicio ||
      existingYear.data_fim !== calendar.data_fim)) {
    return NextResponse.json({
      ok: false, code: "ACADEMIC_YEAR_CALENDAR_MISMATCH",
      error: "As datas do ano letivo não coincidem com a fonte oficial. Concilie-as primeiro.",
    }, { status: 409 });
  }

  if (existingYear) {
    const [{ data: oldPeriods, error: periodError }, { data: oldEvents, error: eventsError }] =
      await Promise.all([
        db.from("periodos_letivos")
          .select("id,numero,data_inicio,data_fim,source_template_id,source_item_id,trava_notas_em,offering_id")
          .eq("escola_id", escolaId).eq("ano_letivo_id", existingYear.id),
        db.from("calendario_eventos")
          .select("id,nome,data_inicio,tipo,offering_id,source_template_id,source_item_id")
          .eq("escola_id", escolaId).eq("ano_letivo_id", existingYear.id),
      ]);
    if (periodError || eventsError) throw periodError ?? eventsError;
    if ((oldPeriods ?? []).some((period: any) =>
      period.trava_notas_em !== null || period.offering_id !== null ||
      !plan.periods.some((candidate) =>
        candidate.numero === period.numero && candidate.data_inicio === period.data_inicio &&
        candidate.data_fim === period.data_fim &&
        candidate.source_template_id === period.source_template_id &&
        candidate.source_item_id === period.source_item_id))) {
      return NextResponse.json({
        ok: false, code: "ACADEMIC_PERIOD_RECONCILIATION_REQUIRED",
        error: "Existem trimestres ou fechos divergentes. É necessária a conciliação antes de reaplicar o calendário.",
      }, { status: 409 });
    }

    // Existing official events must already match the per-offering scope.
    // Do not leave obsolete global events alongside newly scoped profiles.
    if ((oldEvents ?? []).some((event: any) =>
      !plan.events.some((candidate) =>
        candidate.offering_id === event.offering_id &&
        candidate.nome === event.nome && candidate.data_inicio === event.data_inicio &&
        candidate.tipo === event.tipo &&
        candidate.source_template_id === event.source_template_id &&
        candidate.source_item_id === event.source_item_id))) {
      return NextResponse.json({
        ok: false, code: "ACADEMIC_CALENDAR_EXISTING_EVENTS_REVIEW_REQUIRED",
        error: "Os eventos existentes ainda não correspondem às ofertas educativas. Reveja a conciliação.",
      }, { status: 409 });
    }
  }

  // Persist all year/term/event/offer changes in one PostgreSQL statement.
  // If *any* item fails the MED provenance or role check, no partial school
  // year, grade period or profile mapping survives the RPC transaction.
  const { data: applied, error: applyError } = await db.rpc("aplicar_calendario_med_canonico_v1", {
    p_escola_id: escolaId,
    p_ano_base: anoBase,
    p_periodos: plan.periods,
    p_eventos: plan.events,
    p_ofertas: plan.selections,
  });
  if (applyError) {
    const message = String(applyError.message ?? "Falha ao aplicar o calendário.");
    const status = /^AUTH:/i.test(message) ? 403
      : /^DATA:/i.test(message) ? 400
        : /CALENDAR|ACADEMIC|OFFICIAL|TRIMESTER/i.test(message) ? 409 : 500;
    return NextResponse.json({
      ok: false,
      code: String(applyError.code ?? "MED_CALENDAR_APPLY_REJECTED"),
      error: message.replace(/^[A-Z_]+:\s*/, ""),
    }, { status });
  }
  if (applied?.ok !== true || !applied.target_id) {
    throw new Error("A aplicação do calendário oficial não foi confirmada pelo banco.");
  }
  return NextResponse.json({
    ok: true, reused: Boolean(applied.reused),
    target_session: {
      id: String(applied.target_id), ano: anoBase, ativo: false,
      has_data: Boolean(applied.reused),
    },
    calendario_oficial: calendar,
    ofertas_atualizadas: Number(applied.ofertas_atualizadas ?? plan.courseCount),
    trimestres: Number(applied.trimestres ?? plan.periods.length),
    eventos: Number(applied.eventos ?? plan.events.length),
  });
}
