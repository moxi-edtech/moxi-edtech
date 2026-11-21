/**
 * Shared school presentation formats. A calendar date (YYYY-MM-DD) is not a
 * timestamp: never let the viewer's time zone shift it to the previous day.
 * Real instants are displayed in the school's Angola time zone.
 */
export const SCHOOL_LOCALE = "pt-AO";
export const SCHOOL_TIME_ZONE = "Africa/Luanda";

export const kwanza = new Intl.NumberFormat(SCHOOL_LOCALE, {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

export function formatKwanza(valor?: number | null): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return kwanza.format(valor);
}

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const naiveDateTimePattern = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

function parseSchoolDateInput(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const raw = value.trim();

  if (calendarDatePattern.test(raw)) {
    // Noon UTC preserves the same civil date in Africa/Luanda (UTC+01:00).
    const date = new Date(`${raw}T12:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw ? date : null;
  }

  // Postgres timestamp WITHOUT time zone: interpret its wall clock as Luanda
  // instead of using the browser's local time zone. Explicit UTC/offsets pass through.
  const timestamp = naiveDateTimePattern.test(raw)
    ? `${raw.replace(" ", "T")}+01:00`
    : raw;
  const parsed = new Date(timestamp);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function formatDate(dateString?: string | null): string {
  const date = parseSchoolDateInput(dateString);
  if (!date) return "—";
  return new Intl.DateTimeFormat(SCHOOL_LOCALE, {
    timeZone: SCHOOL_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(dateString?: string | null): string {
  if (dateString && calendarDatePattern.test(dateString.trim())) return formatDate(dateString);
  const date = parseSchoolDateInput(dateString);
  if (!date) return "—";
  return new Intl.DateTimeFormat(SCHOOL_LOCALE, {
    timeZone: SCHOOL_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function monthName(mes?: number | null): string {
  if (!Number.isInteger(mes) || mes == null || mes < 1 || mes > 12) return "—";
  return new Intl.DateTimeFormat(SCHOOL_LOCALE, {
    month: "long",
    timeZone: SCHOOL_TIME_ZONE,
  }).format(new Date(Date.UTC(2000, mes - 1, 15, 12)));
}

export function initials(nome?: string | null): string {
  if (!nome?.trim()) return "?";
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}
