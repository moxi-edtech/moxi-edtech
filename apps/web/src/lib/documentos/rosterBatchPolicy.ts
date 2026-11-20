/** Política conservadora de emissão em lote. Valores estáveis por escola e operador. */
import type { NominalOrder } from "@/lib/documentos/nominalExportOptions";

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

/**
 * Contrato de reprocessamento sem novos campos no banco.
 * Tudo guardado na idempotency_key é metadado, nunca contém alunos.
 */
export type NominalBatchPreferences = {
  actorId: string;
  academicYearId: string;
  mode: "ano_letivo" | "operacional" | undefined;
  order?: NominalOrder;
  month: string | undefined;
  isAlbum: boolean;
  includeAllStatus: boolean;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function makeNominalBatchKey(
  preferences: NominalBatchPreferences,
  turmaIds: readonly string[]
): string {
  if (!uuid.test(preferences.actorId) || !uuid.test(preferences.academicYearId)) {
    throw new Error("IDs inválidos para idempotência");
  }
  return [
    "roster", "v3", preferences.actorId, preferences.academicYearId,
    preferences.mode ?? "auto", preferences.month || "none",
    preferences.isAlbum ? "album" : "standard",
    preferences.includeAllStatus ? "todos" : "padrao",
    preferences.order ?? "nome_asc",
    [...turmaIds].sort().join(","),
  ].join(":");
}
export function readNominalBatchKey(key: string | null | undefined): NominalBatchPreferences | null {
  if (!key) return null;
  const parts = key.split(":");
  // v2 jobs remain replayable with their original chamada ordering.
  const legacy = parts[1] === "v2";
  if ((legacy ? parts.length !== 9 : parts.length !== 10) || parts[0] !== "roster" || !["v2", "v3"].includes(parts[1]) ||
      !uuid.test(parts[2]) || !uuid.test(parts[3]) ||
      !["auto", "ano_letivo", "operacional"].includes(parts[4]) ||
      !/^(?:none|0[1-9]|1[0-2])$/.test(parts[5]) ||
      !["album", "standard"].includes(parts[6]) ||
      !["todos", "padrao"].includes(parts[7]) ||
      (!legacy && !["nome_asc", "nome_desc", "chamada"].includes(parts[8])) ||
      !(legacy ? parts[8] : parts[9]).split(",").every(id => uuid.test(id))) {
    return null;
  }
  return {
    actorId: parts[2],
    academicYearId: parts[3],
    mode: parts[4] === "auto" ? undefined : parts[4] as "ano_letivo" | "operacional",
    order: legacy ? "chamada" : parts[8] as NominalOrder,
    month: parts[5] === "none" ? undefined : parts[5],
    isAlbum: parts[6] === "album",
    includeAllStatus: parts[7] === "todos",
  };
}
