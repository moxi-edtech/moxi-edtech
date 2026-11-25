/** Presentation only: never grants permission or changes the academic calendar. */
export const CALENDAR_ZONE = "Africa/Luanda";
export type EventStatus = "scheduled" | "ongoing" | "finished" | "unknown";
export const categoryLabels = {
  holiday: "Feriados", pause: "Pausas e férias", assessment: "Avaliações e exames",
  enrolment: "Matrículas", academic: "Ano lectivo", school: "Eventos escolares", other: "Outros eventos",
} as const;
export type EventCategory = keyof typeof categoryLabels;
export type CalendarEventDates = { tipo: string; data_inicio: string; data_fim: string | null };
const dayFormatter = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: CALENDAR_ZONE });
export function calendarDayKey(value: Date): string {
  const parts = dayFormatter.formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return [part("year"), part("month"), part("day")].join("-");
}
export function calendarDate(value: string | null): Date | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  // SQL DATE is a civil date, not midnight in the browser's timezone.
  const date = new Date(dateOnly ? value + "T12:00:00+01:00" : value);
  if (!Number.isFinite(date.getTime())) return null;
  if (dateOnly && calendarDayKey(date) !== value) return null;
  return date;
}
export function eventStatus(event: CalendarEventDates, now: Date): EventStatus {
  const start = calendarDate(event.data_inicio);
  const end = event.data_fim ? calendarDate(event.data_fim) : start;
  if (!start || !end || !Number.isFinite(now.getTime())) return "unknown";
  const timed = event.tipo === "EVENTO_GERAL" && !/^\d{4}-\d{2}-\d{2}$/.test(event.data_inicio);
  if (timed) {
    if (end < start) return "unknown";
    if (now < start) return "scheduled";
    return now > end ? "finished" : "ongoing";
  }
  const first = calendarDayKey(start), last = calendarDayKey(end), today = calendarDayKey(now);
  if (last < first) return "unknown";
  if (today < first) return "scheduled";
  return today > last ? "finished" : "ongoing";
}
export function eventCategory(tipo: string): EventCategory {
  switch (tipo) {
    case "FERIADO": return "holiday";
    case "PAUSA_PEDAGOGICA": case "FERIAS_ALUNOS": return "pause";
    case "PROVA_TRIMESTRAL": case "EXAME_NACIONAL": case "EXAME_ORAL": case "EXAME_ESCRITO": case "EXAME_EXTRAORDINARIO": return "assessment";
    case "MATRICULA": return "enrolment";
    case "PERIODO_LETIVO": case "PREPARACAO_ANO_LETIVO": case "ENCERRAMENTO_ANO_LETIVO": return "academic";
    case "EVENTO_GERAL": case "EVENTO_ESCOLA": return "school";
    default: return "other";
  }
}
/** Mirrors the existing academic interruption types; not a live permission check. */
export function isScheduledPedagogicalInterruption(tipo: string): boolean {
  return tipo === "FERIADO" || tipo === "PAUSA_PEDAGOGICA";
}
