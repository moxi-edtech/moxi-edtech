import { auditDecreeSync, type DecreeSyncSnapshot } from "./decree-sync-health";

/**
 * Server-only read of the decree-backed calendar for a single school/year.
 * The caller must first authorize the user for escolaId. All queries remain
 * school-scoped; this helper never writes data or changes the academic year.
 */
export async function inspectDecreeSync(db: any, escolaId: string, ano: number) {
  const [yearResult, offersResult] = await Promise.all([
    db.from("anos_letivos")
      .select("id,ano,data_inicio,data_fim")
      .eq("escola_id", escolaId).eq("ano", ano).maybeSingle(),
    db.from("school_education_offerings")
      .select("id,education_subsystem,calendar_profile_id")
      .eq("escola_id", escolaId).eq("status", "active"),
  ]);
  if (yearResult.error) throw yearResult.error;
  if (offersResult.error) throw offersResult.error;

  const year = yearResult.data;
  const offerings = offersResult.data ?? [];
  const empty: DecreeSyncSnapshot = { year: null, offerings, templates: [], periods: [], events: [] };
  if (!year) return auditDecreeSync(empty);

  const templateIds = [...new Set(
    (offerings as Array<{ calendar_profile_id: string | null }>)
      .map((offer) => offer.calendar_profile_id)
      .filter((id): id is string => Boolean(id))
  )];
  const [templatesResult, periodsResult, eventsResult] = await Promise.all([
    templateIds.length
      ? db.from("calendario_templates")
        .select("id,ano_base,subsistema,data_inicio,data_fim,estado,is_oficial,versao_documento,fonte_documento_url,fonte_referencia,items:calendario_template_items(id,tipo,numero,nome,data_inicio,data_fim,peso,applies_to_all_offerings)")
        .in("id", templateIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("periodos_letivos")
      .select("id,numero,tipo,data_inicio,data_fim,offering_id,source_template_id,source_item_id,source_version")
      .eq("escola_id", escolaId).eq("ano_letivo_id", year.id),
    db.from("calendario_eventos")
      .select("id,nome,tipo,data_inicio,data_fim,offering_id,source_template_id,source_item_id,source_version")
      .eq("escola_id", escolaId).eq("ano_letivo_id", year.id),
  ]);
  for (const result of [templatesResult, periodsResult, eventsResult]) {
    if (result.error) throw result.error;
  }
  return auditDecreeSync({
    year: year as DecreeSyncSnapshot["year"],
    offerings: offerings as DecreeSyncSnapshot["offerings"],
    templates: (templatesResult.data ?? []) as DecreeSyncSnapshot["templates"],
    periods: (periodsResult.data ?? []) as DecreeSyncSnapshot["periods"],
    events: (eventsResult.data ?? []) as DecreeSyncSnapshot["events"],
  });
}
