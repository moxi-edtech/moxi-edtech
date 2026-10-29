import { NextResponse } from "next/server";
import {
  buildCanonicalMedCalendarPlan,
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
}) {
  const { db, escolaId, userId, anoBase } = input;
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
    plan = buildCanonicalMedCalendarPlan({
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

  let targetId: string | null = existingYear?.id ?? null;
  if (!targetId) {
    const { data, error } = await db.rpc("setup_active_ano_letivo", {
      p_escola_id: escolaId,
      p_ano_data: {
        ano: anoBase, data_inicio: calendar.data_inicio,
        data_fim: calendar.data_fim, ativo: false,
      },
    });
    if (error) throw error;
    targetId = data?.id ?? null;
    if (!targetId) {
      const fetched = await db.from("anos_letivos").select("id")
        .eq("escola_id", escolaId).eq("ano", anoBase).maybeSingle();
      if (fetched.error) throw fetched.error;
      targetId = fetched.data?.id ?? null;
    }
    if (!targetId) throw new Error("Não foi possível criar a sessão do calendário canónico.");
  }

  const periodPayload = plan.periods.map((item) => ({ ...item, ano_letivo_id: targetId }));
  const { error: periodWriteError } = await db.rpc("upsert_bulk_periodos_letivos", {
    p_escola_id: escolaId, p_periodos_data: periodPayload,
  });
  if (periodWriteError) throw periodWriteError;

  if (plan.events.length > 0) {
    const { error: eventWriteError } = await db.from("calendario_eventos").upsert(
      plan.events.map((event) => ({
        ...event, escola_id: escolaId, ano_letivo_id: targetId,
        applied_at: new Date().toISOString(), applied_by: userId,
      })),
      { onConflict: "escola_id,ano_letivo_id,offering_id,nome,data_inicio" },
    );
    if (eventWriteError) throw eventWriteError;
  }

  // Mapping is committed only after the canonical year and events succeeded.
  for (const mapping of plan.selections) {
    const { error } = await db.from("school_education_offerings")
      .update({ calendar_profile_id: mapping.template_id, updated_at: new Date().toISOString() })
      .eq("id", mapping.offering_id).eq("escola_id", escolaId);
    if (error) throw error;
  }

  return NextResponse.json({
    ok: true, reused: Boolean(existingYear),
    target_session: { id: targetId, ano: anoBase, ativo: false, has_data: Boolean(existingYear) },
    calendario_oficial: calendar,
    ofertas_atualizadas: plan.courseCount,
    trimestres: plan.periods.length,
    eventos: plan.events.length,
  });
}
