import { DEFAULT_SCHOOL_TIMEZONE } from "@/lib/academic-year/context";

function minutes(value: string | null | undefined) {
  if (!value) return null;
  const [hours, mins] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
}

export function isWithinSchoolLessonWindow(
  date: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const currentDate = `${values.year}-${values.month}-${values.day}`;
  const currentMinutes = Number(values.hour) * 60 + Number(values.minute);
  const startMinutes = minutes(start);
  const endMinutes = minutes(end);

  return Boolean(
    date && date === currentDate &&
    startMinutes !== null && endMinutes !== null &&
    currentMinutes >= startMinutes && currentMinutes < endMinutes,
  );
}
