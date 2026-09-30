import type { ActivityFeedItem } from "@/lib/admin/activityFeed";

export type ActivityDetailKind =
  | "person"
  | "group"
  | "money"
  | "date"
  | "document"
  | "payment"
  | "subject"
  | "status"
  | "description"
  | "operation";

export type ActivityDetail = {
  label: string;
  value: string;
  kind: ActivityDetailKind;
};

type Payload = Record<string, unknown>;

function firstValue(payload: Payload, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = payload[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function humanize(value: string): string {
  const normalized = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function formatValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("pt-PT");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return null;
}

function formatMoney(value: unknown): string | null {
  const numeric = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(numeric)) return formatValue(value);
  return `${numeric.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Kz`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addDetail(
  details: ActivityDetail[],
  label: string,
  value: unknown,
  kind: ActivityDetailKind,
  formatter: (input: unknown) => string | null = formatValue,
) {
  const formatted = formatter(value);
  if (!formatted || details.some((detail) => detail.label === label && detail.value === formatted)) return;
  details.push({ label, value: formatted, kind });
}

export function buildActivityDetails(item: ActivityFeedItem): ActivityDetail[] {
  const payload = item.payload ?? {};
  const details: ActivityDetail[] = [];

  addDetail(details, "Operação", humanize(item.event_type), "operation");
  addDetail(details, "Aluno", item.aluno_nome ?? firstValue(payload, ["aluno_nome", "nome_aluno"]), "person");
  addDetail(details, "Turma", item.turma_nome ?? firstValue(payload, ["turma_nome", "nome_turma"]), "group");
  addDetail(
    details,
    "Valor",
    item.amount_kz ?? firstValue(payload, ["valor_numeric", "valor", "amount", "montante"]),
    "money",
    formatMoney,
  );
  addDetail(details, "Referência", firstValue(payload, ["mes_referencia", "referencia", "periodo_nome", "competencia"]), "date");
  addDetail(details, "Documento", firstValue(payload, ["tipo_documento", "documento_nome", "documento"]), "document");
  addDetail(details, "Método de pagamento", firstValue(payload, ["metodo_pagamento", "pago_via", "forma_pagamento"]), "payment");
  addDetail(details, "Disciplina", firstValue(payload, ["disciplina_nome", "disciplina", "materia"]), "subject");
  addDetail(details, "Avaliação", firstValue(payload, ["avaliacao_nome", "avaliacao", "tipo_avaliacao"]), "subject");

  const fromStatus = formatValue(firstValue(payload, ["from_status", "status_anterior", "estado_anterior"]));
  const toStatus = formatValue(firstValue(payload, ["to_status", "status_novo", "estado_novo", "status", "estado"]));
  const status = fromStatus && toStatus
    ? `${humanize(fromStatus)} → ${humanize(toStatus)}`
    : toStatus
      ? humanize(toStatus)
      : null;
  addDetail(details, "Estado", status, "status");

  addDetail(details, "Quantidade", firstValue(payload, ["quantidade", "total", "count", "registos"]), "operation");
  addDetail(details, "Motivo", firstValue(payload, ["motivo", "reason", "observacao", "nota"]), "description");

  const subline = item.subline?.trim();
  if (subline && !details.some((detail) => detail.value === subline)) {
    addDetail(details, "Descrição", subline, "description");
  }

  addDetail(details, "Responsável", item.actor_name?.trim(), "person");
  addDetail(details, "Data e hora", formatDateTime(item.occurred_at), "date");

  return details;
}
