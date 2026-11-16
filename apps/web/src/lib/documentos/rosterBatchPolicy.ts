/** Política conservadora de emissão em lote. Valores estáveis por escola e operador. */
export const MAX_TURMAS_POR_LOTE = 10;
export const MAX_LOTES_NOMINAIS_POR_HORA = 10;

export function uniqueTurmaIds(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}

/** Um ZIP parcial pode ser descarregado; os erros continuam visíveis por turma. */
export function statusFinalLote(successCount: number): "SUCCESS" | "FAILED" {
  return successCount > 0 ? "SUCCESS" : "FAILED";
}
export function parcialLote(successCount: number, failedCount: number): boolean {
  return successCount > 0 && failedCount > 0;
}

export type ItemLote = { turma_id: string; status: string; error_message?: string | null };
export function progressoLote(itens: readonly ItemLote[]): {
  processed: number; successCount: number; failedCount: number;
} {
  return {
    processed: itens.filter(x => x.status === "SUCCESS" || x.status === "FAILED").length,
    successCount: itens.filter(x => x.status === "SUCCESS").length,
    failedCount: itens.filter(x => x.status === "FAILED").length,
  };
}
