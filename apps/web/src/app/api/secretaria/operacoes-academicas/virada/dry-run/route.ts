import { NextResponse } from "next/server";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { buildCutoverHealthReport } from "@/lib/operacoes-academicas/cutover-health";
import { reviewCanonicalCutoverTarget } from "@/lib/academico/validate-canonical-cutover";
import type { CanonicalMedCalendar, MedCourseProfile, MedCourseOffering } from "@/lib/academico/canonical-med-calendar";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * A cutover dry-run cannot publish a future year on the strength of a list
 * of subsystem templates. It audits the single canonical MED year, the
 * chosen profiles for every school course and the records actually applied
 * to each target session. It performs no mutations.
 */
export async function POST() {
  const supabase = await supabaseServerTyped<Database>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) {
    return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
  }
  const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
  if (!authz.allowed) {
    return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
  }

  const report = await buildCutoverHealthReport(supabase, escolaId);
  const activeYear = report.active_year?.ano ?? null;
  const db = supabase as any;
  const noActiveYear = { data: [], error: null };
  const [targetsResult, calendarResult, profilesResult, offeringsResult, pendingImportsResult] = await Promise.all([
    activeYear === null ? Promise.resolve(noActiveYear)
      : db.from("anos_letivos")
          .select("id,ano,ativo,data_inicio,data_fim")
          .eq("escola_id", escolaId).gt("ano", activeYear)
          .order("ano", { ascending: true }).limit(20),
    activeYear === null ? Promise.resolve(noActiveYear)
      : db.from("calendarios_oficiais_anos")
          .select("ano_base,data_inicio,data_fim,versao_documento,estado")
          .eq("estado", "PUBLICADO").gt("ano_base", activeYear)
          .order("ano_base", { ascending: true }).limit(20),
    activeYear === null ? Promise.resolve(noActiveYear)
      : db.from("calendario_templates")
          .select("id,nome,ano_base,calendario_canonico_ano,data_inicio,data_fim,subsistema,is_oficial,estado,versao_documento,items:calendario_template_items(*)")
          .eq("is_oficial", true).eq("estado", "PUBLICADO")
          .gt("ano_base", activeYear).limit(50),
    db.from("school_education_offerings")
      .select("id,course_id,education_subsystem,education_level,cycle,grades,calendar_profile_id")
      .eq("escola_id", escolaId).eq("status", "active").limit(500),
    db.from("virada_importacoes").select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId).eq("status", "APROVADO"),
  ]);

  const readinessErrors = [
    targetsResult.error, calendarResult.error, profilesResult.error,
    offeringsResult.error, pendingImportsResult.error,
  ].filter(Boolean).map((error: { message?: string }) => error.message || "Falha na verificação operacional");
  const blockers: string[] = [...report.blockers];
  if (activeYear === null) blockers.push("Nenhum ano letivo ativo foi encontrado.");
  const targets = (targetsResult.data ?? []) as Array<{
    id: string; ano: number; ativo: boolean;
    data_inicio: string; data_fim: string;
  }>;
  if (targets.length === 0) {
    blockers.push("Crie e confirme o ano letivo de destino antes de executar a virada.");
  }
  if (readinessErrors.length > 0) {
    blockers.push("Não foi possível concluir todas as verificações do dry-run.");
  }

  if ((targetsResult.data ?? []).length >= 20 ||
      (calendarResult.data ?? []).length >= 20 ||
      (profilesResult.data ?? []).length >= 50 ||
      (offeringsResult.data ?? []).length >= 500) {
    blockers.push("O catálogo de anos ou perfis excede os limites da auditoria. Reveja a configuração.");
  }
  const calendars = (calendarResult.data ?? []) as CanonicalMedCalendar[];
  const profiles = (profilesResult.data ?? []) as MedCourseProfile[];
  const offerings = (offeringsResult.data ?? []) as Array<
    MedCourseOffering & { calendar_profile_id: string | null }
  >;
  // Match the write planner: type-specific official events must be
  // evaluated using the real course classification.
  const courseIds = [...new Set(offerings.map((item) => item.course_id).filter(Boolean))];
  const { data: courses, error: coursesError } = courseIds.length > 0
    ? await db.from("cursos").select("id,tipo")
        .eq("escola_id", escolaId).in("id", courseIds)
    : { data: [], error: null };
  if (coursesError) {
    readinessErrors.push(coursesError.message || "Não foi possível identificar os cursos.");
    blockers.push("Não foi possível verificar a aplicabilidade do calendário aos cursos.");
  }
  const courseTypes = new Map<string, string | null>(
    (courses ?? []).map((course: { id: string; tipo: string | null }) =>
      [course.id, course.tipo] as const),
  );
  const enrichedOfferings = offerings.map((offering) => ({
    ...offering,
    course_type: offering.course_id ? courseTypes.get(offering.course_id) ?? null : null,
  }));
  const calendarByYear = new Map(calendars.map((item) => [item.ano_base, item] as const));
  const targetChecks = await Promise.all(targets.map(async (target) => {
    const [{ data: recordedPeriods, error: periodsError },
      { data: recordedEvents, error: eventsError }] = await Promise.all([
      db.from("periodos_letivos")
        .select("numero,tipo,data_inicio,data_fim,peso,source_template_id,source_item_id,offering_id")
        .eq("escola_id", escolaId).eq("ano_letivo_id", target.id).limit(30),
      db.from("calendario_eventos")
        .select("offering_id,nome,data_inicio,data_fim,tipo,source_template_id,source_item_id")
        .eq("escola_id", escolaId).eq("ano_letivo_id", target.id).limit(500),
    ]);
    if (periodsError || eventsError ||
        (recordedPeriods ?? []).length >= 30 || (recordedEvents ?? []).length >= 500) {
      return {
        ano: target.ano, ano_letivo_id: target.id,
        ready: false,
        blockers: ["Não foi possível consultar trimestres e eventos do ano de destino."],
        periods: 0, events: 0, offerings: offerings.length,
      };
    }
    const candidates = profiles.filter((item) => item.ano_base === target.ano);
    const selections = offerings.map((item) => ({
      offering_id: item.id,
      template_id: item.calendar_profile_id ?? "",
    }));
    return reviewCanonicalCutoverTarget({
      target,
      calendar: calendarByYear.get(target.ano) ?? null,
      profiles: candidates,
      offerings: enrichedOfferings,
      selections,
      recordedPeriods: recordedPeriods ?? [],
      recordedEvents: recordedEvents ?? [],
    });
  }));
  const readyCount = targetChecks.filter((item) => item.ready).length;
  if (targets.length > 0 && readyCount === 0) {
    blockers.push("Nenhum ano de destino está completamente reconciliado com o calendário oficial e os cursos.");
  }

  const warnings = [...report.warnings];
  const pendingImports = pendingImportsResult.count ?? 0;
  if (pendingImports > 0) {
    warnings.push(`${pendingImports} lote(s) de notas aprovado(s) aguardam aplicação.`);
  }
  const canExecute = report.can_cutover && blockers.length === 0 && readyCount > 0;

  return NextResponse.json({
    ok: true, dry_run: true,
    can_execute: canExecute,
    status: canExecute ? report.status : "BLOCKED",
    blockers, warnings,
    readiness: {
      target_sessions: targets,
      official_calendars: calendars,
      // Keep the property for historical clients, but it now contains only
      // one canonical year per row, never four independent subsystems.
      official_templates: calendars.map((item) => ({
        ano_base: item.ano_base, nome: `Calendário MED ${item.ano_base}/${item.ano_base + 1}`,
        versao_documento: item.versao_documento,
      })),
      target_calendar_checks: targetChecks,
      approved_note_batches_pending_apply: pendingImports,
      errors: readinessErrors,
    },
    report,
  }, { headers: { "Cache-Control": "no-store" } });
}
