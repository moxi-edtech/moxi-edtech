/**
 * PostgreSQL DATE (YYYY-MM-DD) is a civil date, not a UTC timestamp.
 * new Date('YYYY-MM-DD') shifts it to the previous day in time zones west of UTC.
 */
export function formatReceiptDate(value: string | null | undefined): string {
  if (!value) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const yearNumber = Number(year);
    const monthNumber = Number(month);
    const dayNumber = Number(day);
    const check = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
    if (check.getUTCFullYear() === yearNumber &&
        check.getUTCMonth() + 1 === monthNumber &&
        check.getUTCDate() === dayNumber) {
      return `${day}/${month}/${year}`;
    }
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("pt-PT", { timeZone: "Africa/Luanda", day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}
