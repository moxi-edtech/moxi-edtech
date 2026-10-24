/** Pure validation of the published template's year range before changing
 * school offerings, creating a target session or copying calendar events.
 * ISO civil dates only; no local-time / DST-dependent parsing.
 */
export type OfficialAcademicTemplate = {
  ano_base: number;
  data_inicio: string | null;
  data_fim: string | null;
  items?: Array<{ tipo: string; data_inicio: string | null; data_fim: string | null }> | null;
};

function parseCivilDate(value: string | null, field: string): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(field + " is required as YYYY-MM-DD");
  }
  const [year, month, day] = value.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const parsed = new Date(utc);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new RangeError(field + " is not a real civil date");
  }
  return utc;
}

export function resolveTargetAcademicYear(
  templateBaseYear: number,
  activeAcademicYear: number | null,
): number {
  if (!Number.isInteger(templateBaseYear) || templateBaseYear < 2000 || templateBaseYear > 2100) {
    throw new RangeError("invalid template base year");
  }
  if (activeAcademicYear === null) return templateBaseYear;
  if (!Number.isInteger(activeAcademicYear) || activeAcademicYear < 2000 || activeAcademicYear > 2100) {
    throw new RangeError("invalid active academic year");
  }
  if (templateBaseYear < activeAcademicYear) {
    throw new RangeError("template is older than active academic year");
  }
  return Math.max(templateBaseYear, activeAcademicYear + 1);
}

export function resolvePublishedAcademicCalendar(input: {
  templates: readonly OfficialAcademicTemplate[];
  activeYear: { ano: number; data_fim: string | null } | null;
}): { year: number; dataInicio: string; dataFim: string } {
  const { templates, activeYear } = input;
  if (!templates.length) throw new RangeError("at least one published template is required");

  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  let target: number | null = null;
  for (const template of templates) {
    const from = parseCivilDate(template.data_inicio, "template.data_inicio");
    const to = parseCivilDate(template.data_fim, "template.data_fim");
    if (to <= from || to - from > 550 * 86_400_000) {
      throw new RangeError("invalid template date range");
    }
    const startYear = Number(template.data_inicio!.slice(0, 4));
    const endYear = Number(template.data_fim!.slice(0, 4));
    if (template.ano_base !== startYear && template.ano_base !== endYear) {
      throw new RangeError("ano_base does not belong to official calendar period");
    }
    for (const item of template.items ?? []) {
      if (item.tipo !== "PERIODO_LETIVO") continue;
      const itemStart = parseCivilDate(item.data_inicio, "PERIODO_LETIVO.data_inicio");
      const itemEnd = parseCivilDate(item.data_fim, "PERIODO_LETIVO.data_fim");
      if (itemStart < from || itemEnd > to || itemEnd < itemStart) {
        throw new RangeError("academic period lies outside its published template");
      }
    }

    const year = resolveTargetAcademicYear(template.ano_base, activeYear?.ano ?? null);
    if (target !== null && target !== year) {
      throw new RangeError("published templates target different academic years");
    }
    target = year;
    start = Math.min(start, from);
    end = Math.max(end, to);
  }
  if (end - start > 550 * 86_400_000) {
    throw new RangeError("combined academic calendars span too many days");
  }
  if (activeYear?.data_fim && start <= parseCivilDate(activeYear.data_fim, "activeYear.data_fim")) {
    throw new RangeError("published calendar overlaps the active academic session");
  }
  return {
    year: target!,
    dataInicio: new Date(start).toISOString().slice(0, 10),
    dataFim: new Date(end).toISOString().slice(0, 10),
  };
}
