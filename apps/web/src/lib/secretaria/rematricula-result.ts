export type RematriculaOutcome = "completed" | "document_pending" | "academic_history_pending" | "error";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function isDocumentPendingResult(payload: unknown): boolean {
  const record = asRecord(payload);
  return record.code === "DOCUMENT_PENDING";
}

export function isAcademicHistoryPendingResult(payload: unknown): boolean {
  const record = asRecord(payload);
  return record.code === "ACADEMIC_HISTORY_PENDING";
}

/**
 * Classifica o resultado sem transformar qualquer 2xx em sucesso.
 *
 * DOCUMENT_PENDING é um estado parcial conhecido: matrícula/pagamento podem
 * estar concluídos enquanto o comprovante ainda falhou. Outros 202 continuam
 * sendo erro até que tenham um contrato explícito.
 */
export function classifyRematriculaResponse(
  httpStatus: number,
  payload: unknown,
): RematriculaOutcome {
  const record = asRecord(payload);

  if (isDocumentPendingResult(record)) {
    return "document_pending";
  }

  if (isAcademicHistoryPendingResult(record)) {
    return "academic_history_pending";
  }

  if (httpStatus >= 200 && httpStatus < 300 && record.ok === true) {
    return "completed";
  }

  return "error";
}
