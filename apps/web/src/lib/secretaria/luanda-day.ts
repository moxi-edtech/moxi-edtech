const LUANDA_TIMEZONE = "Africa/Luanda";

/** Limites do dia em Angola, expressos em UTC para consultas timestampz. */
export function getLuandaDayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LUANDA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new Error("Não foi possível obter a data em Angola");

  // Angola usa UTC+01 permanentemente, sem mudança sazonal de hora.
  const startMs = Date.parse(`${year}-${month}-${day}T00:00:00+01:00`);
  if (!Number.isFinite(startMs)) throw new Error("Dia de Angola inválido");

  return {
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(startMs + 86_400_000).toISOString(),
  };
}
