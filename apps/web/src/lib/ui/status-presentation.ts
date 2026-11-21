/** Semantic state mapping: business status drives tone, not the visible label. */
export type StatusVariant = "matricula" | "financeiro";
export type StatusTone = "success" | "pending" | "danger" | "neutral";

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  success: "border-klasse-green/20 bg-klasse-green/10 text-klasse-green",
  pending: "border-amber-400/50 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300",
  neutral: "border-border bg-muted text-muted-foreground",
};

const PAID = new Set(["pago", "em_dia", "quitado", "liquidado"]);
const DUE = new Set(["pendente", "em_aberto", "aguardando_pagamento", "aguardando_validacao"]);
const NO_CHARGE = new Set(["isento", "cancelado", "anulado", "sem_cobranca"]);
const ACTIVE = new Set(["ativo", "ativa", "confirmado", "confirmada", "matriculado", "matriculada"]);
const INACTIVE = new Set(["arquivado", "arquivada", "inativo", "inativa", "desistente", "cancelado", "cancelada"]);
const REJECTED = new Set(["rejeitado", "rejeitada", "indeferido", "indeferida"]);

export function normalizeStatusKey(status?: string | null): string {
  return (status ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function getStatusTone(status?: string | null, variant: StatusVariant = "matricula"): StatusTone {
  const key = normalizeStatusKey(status);
  if (!key) return "neutral";

  if (variant === "financeiro") {
    if (PAID.has(key)) return "success";
    if (key.includes("atras") || key === "inadimplente" || key === "vencido" || key === "vencida") return "danger";
    if (DUE.has(key)) return "pending";
    if (NO_CHARGE.has(key)) return "neutral";
    // Unknown financial states must never be advertised as paid or overdue.
    return "neutral";
  }

  if (ACTIVE.has(key)) return "success";
  if (REJECTED.has(key)) return "danger";
  if (INACTIVE.has(key)) return "neutral";
  if (key === "pendente" || key === "rascunho" || key === "em_analise" || key === "aguardando") return "pending";
  return "neutral";
}

export function getStatusLabel(status?: string | null): string {
  return status?.trim().replace(/_/g, " ") || "—";
}
