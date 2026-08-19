export function todayInLuanda(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Future competencies are not debt and must not block rematrícula. */
export function isMensalidadeVencida(mensalidade: any, today = todayInLuanda()): boolean {
  const dueDate = mensalidade.data_vencimento ?? mensalidade.vencimento;
  if (dueDate) return String(dueDate).slice(0, 10) <= today;

  const year = Number(mensalidade.ano_referencia ?? mensalidade.ano ?? 0);
  const month = Number(mensalidade.mes_referencia ?? mensalidade.mes ?? 0);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  return year > 0 && month > 0 && year * 100 + month <= todayYear * 100 + todayMonth;
}
