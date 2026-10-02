export type RematriculaDebtRow = {
  status?: string | null;
  valor_previsto?: number | string | null;
  valor?: number | string | null;
  valor_pago_total?: number | string | null;
  data_vencimento?: string | null;
};

const NON_BLOCKING_STATUSES = new Set(["pago", "isento", "cancelado"]);

export function currentDateInLuanda(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function rematriculaOutstandingBalance(row: RematriculaDebtRow): number {
  return Math.max(
    Number(row.valor_previsto ?? row.valor ?? 0) - Number(row.valor_pago_total ?? 0),
    0,
  );
}

export function isOverdueRematriculaDebt(
  row: RematriculaDebtRow,
  today = currentDateInLuanda(),
): boolean {
  const status = String(row.status ?? "").toLowerCase();
  if (NON_BLOCKING_STATUSES.has(status)) return false;
  if (rematriculaOutstandingBalance(row) <= 0) return false;

  const dueDate = typeof row.data_vencimento === "string"
    ? row.data_vencimento.slice(0, 10)
    : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false;

  // A mensalidade só é vencida no dia seguinte ao vencimento.
  return dueDate < today;
}

export function summarizeOverdueRematriculaDebt(
  rows: RematriculaDebtRow[],
  today = currentDateInLuanda(),
) {
  const overdue = rows.filter((row) => isOverdueRematriculaDebt(row, today));
  return {
    count: overdue.length,
    total: overdue.reduce((sum, row) => sum + rematriculaOutstandingBalance(row), 0),
    rows: overdue,
  };
}
