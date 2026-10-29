export type GradePeriodRow = {
  id: string;
  numero: number;
  data_inicio: string | null;
  data_fim: string | null;
  trava_notas_em: string | null;
};

export type GradePeriodState = "current" | "future" | "past" | "locked" | "unconfigured";

export function schoolCalendarDate(now: Date, timeZone = "Africa/Luanda"): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return [date.year, date.month, date.day].join("-");
}

export function gradePeriodState(
  period: Pick<GradePeriodRow, "data_inicio" | "data_fim" | "trava_notas_em">,
  now = new Date(),
  timeZone = "Africa/Luanda",
): GradePeriodState {
  const start = period.data_inicio;
  const end = period.data_fim;
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return "unconfigured";
  if (period.trava_notas_em) {
    const lock = Date.parse(period.trava_notas_em);
    if (!Number.isFinite(lock)) return "unconfigured";
    if (lock <= now.getTime()) return "locked";
  }
  const today = schoolCalendarDate(now, timeZone);
  if (today < start) return "future";
  if (today > end) return "past";
  return "current";
}

export function currentGradePeriod(
  periods: ReadonlyArray<GradePeriodRow>, now = new Date(), timeZone = "Africa/Luanda",
): number | null {
  const matching = periods.filter((period) => gradePeriodState(period, now, timeZone) === "current");
  return matching.length === 1 && Number.isInteger(matching[0].numero) &&
    matching[0].numero >= 1 && matching[0].numero <= 3
    ? matching[0].numero : null;
}
