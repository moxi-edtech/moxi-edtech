export const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

export function formatKwanza(valor?: number | null): string {
  if (valor == null) return "—";
  return kwanza.format(valor);
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function monthName(mes?: number | null): string {
  const m = mes ?? null;
  if (!m || m < 1 || m > 12) return "—";
  return new Date(0, m - 1).toLocaleString("pt-PT", { month: "long" });
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
