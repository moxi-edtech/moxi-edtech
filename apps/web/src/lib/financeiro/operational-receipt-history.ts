/**
 * Server-only projection of an already issued operational receipt.
 * Never creates a document or interprets an outbox event as proof of issuance.
 */
export type OperationalReceiptHistoryRow = {
  id: string;
  created_at: string;
  mensalidade_id: string | null;
  numero_sequencial: number | null;
  dados_snapshot: unknown;
};

export type OperationalReceiptHistoryItem = {
  id: string;
  emittedAt: string;
  number: number | null;
  kind: "mensalidade" | "matricula" | "rematricula" | "servico";
  label: string;
  description: string;
  amount: number | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function amount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const valueAsNumber = typeof value === "number" ? value : Number(value);
  return Number.isFinite(valueAsNumber) && valueAsNumber >= 0 ? valueAsNumber : null;
}

function normalized(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function toOperationalReceiptHistoryItem(
  row: OperationalReceiptHistoryRow,
): OperationalReceiptHistoryItem {
  const snapshot = record(row.dados_snapshot);
  const markers = normalized([
    str(snapshot.tipo_comprovativo),
    str(snapshot.origem),
    str(snapshot.origem_operacao),
    str(snapshot.tipo_operacao),
  ].filter(Boolean).join(" "));

  const kind: OperationalReceiptHistoryItem["kind"] =
    /rematricul|reconfirm|confirmacao/.test(markers)
      ? "rematricula"
      : /matricul|admissao|inscricao/.test(markers)
        ? "matricula"
        : row.mensalidade_id
          ? "mensalidade"
          : "servico";

  const label = {
    mensalidade: "Mensalidade",
    matricula: "Matrícula",
    rematricula: "Rematrícula",
    servico: "Serviços",
  }[kind];

  const lines = Array.isArray(snapshot.itens_pagamento)
    ? snapshot.itens_pagamento
    : Array.isArray(snapshot.itens)
      ? snapshot.itens
      : [];

  // Match the print view's rule: use item amounts where present; otherwise
  // use the persisted receipt total (never recalculate from today's prices).
  const itemAmounts = lines.map((item) => {
    const line = record(item);
    return amount(line.valor ?? line.preco ?? line.amount);
  });
  const hasValidLines = lines.length > 0
    && itemAmounts.every((value) => value !== null);
  const sum = hasValidLines
    ? itemAmounts.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;
  const total = sum !== null && sum > 0
    ? sum
    : amount(snapshot.valor_pago ?? snapshot.valor_total ?? snapshot.total);

  const firstLine = lines.length ? record(lines[0]) : {};
  const reference = str(snapshot.referencia)
    ?? str(firstLine.descricao)
    ?? str(firstLine.nome)
    ?? str(firstLine.referencia);
  const description = reference
    ? reference.slice(0, 120)
    : kind === "mensalidade" ? "Recibo de mensalidade"
      : kind === "matricula" ? "Recibo de matrícula"
        : kind === "rematricula" ? "Recibo de rematrícula"
          : "Recibo de serviço escolar";

  return {
    id: row.id,
    emittedAt: row.created_at,
    number: row.numero_sequencial,
    kind,
    label,
    description,
    amount: total,
  };
}
