/**
 * Read-only receipt recovery after the financial transaction has committed.
 * The delayed consumer issues a receipt independently; polling MUST NOT
 * repeat the original payment or invoke any receipt-emission RPC.
 */
export type ReceiptLookup = {
  ok?: boolean;
  status?: "ready" | "pending";
  print_url?: string | null;
  error?: string;
};

export type ReceiptLookupOptions = {
    fetcher?: typeof fetch;
    pause?: (ms: number) => Promise<void>;
    signal?: AbortSignal;
    attempts?: number;
    escolaId?: string;
};

async function findIssuedReceipt(
  idKind: "mensalidade_id" | "pagamento_id",
  id: string,
  opts: ReceiptLookupOptions = {},
): Promise<string | null> {
  const fetcher = opts.fetcher ?? fetch;
  const pause = opts.pause ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const max = Math.min(Math.max(opts.attempts ?? 12, 1), 20);
  const path = "/api/secretaria/recibos/consultar?" + idKind + "=" + encodeURIComponent(id)
    + (opts.escolaId ? "&escola_id=" + encodeURIComponent(opts.escolaId) : "");
  for (let attempt = 0; attempt < max; attempt += 1) {
    if (opts.signal?.aborted) return null;
    const response = await fetcher(path, { method: "GET", cache: "no-store", signal: opts.signal });
    const json = await response.json().catch(() => ({})) as ReceiptLookup;
    if (!response.ok && response.status !== 202) {
      throw new Error(json.error || "Falha ao consultar o recibo já emitido.");
    }
    if (json.ok && json.status === "ready" && typeof json.print_url === "string" && json.print_url.startsWith("/secretaria/documentos/")) {
      return json.print_url;
    }
    if (attempt < max - 1) await pause(1000);
  }
  return null;
}

/** Resolve by mensalidade, including a consolidated batch receipt. */
export function findIssuedOperationalReceipt(
  mensalidadeId: string,
  opts: ReceiptLookupOptions = {},
): Promise<string | null> {
  return findIssuedReceipt("mensalidade_id", mensalidadeId, opts);
}

/** Resolve admission/service receipts using the settled payment's identity. */
export function findIssuedOperationalReceiptByPayment(
  pagamentoId: string,
  opts: ReceiptLookupOptions = {},
): Promise<string | null> {
  return findIssuedReceipt("pagamento_id", pagamentoId, opts);
}

/**
 * Open a document tab synchronously in the user's click event.
 * Browser popup blockers can reject a delayed window.open call after await.
 */
export function reserveReceiptWindow(): Window | null {
  let receiptWindow: Window | null = null;
  try {
    receiptWindow = window.open("about:blank", "_blank");
    if (receiptWindow) {
      receiptWindow.opener = null;
      receiptWindow.document.title = "A preparar recibo…";
      receiptWindow.document.body.textContent = "Pagamento em processamento. O recibo ficará disponível nesta janela.";
    }
  } catch {
    // Never allow a blocked popup to affect the financial transaction.
  }
  return receiptWindow;
}

export function showIssuedReceipt(receiptWindow: Window | null, printUrl: string): boolean {
  if (!receiptWindow || receiptWindow.closed) return false;
  try {
    receiptWindow.location.replace(printUrl);
    return true;
  } catch {
    return false;
  }
}

export function showReceiptPending(receiptWindow: Window | null): void {
  if (!receiptWindow || receiptWindow.closed) return;
  try {
    receiptWindow.document.title = "Recibo em preparação";
    receiptWindow.document.body.textContent =
      "O pagamento foi registado. O recibo ainda está em preparação. Não efetue outro pagamento; consulte a ficha financeira do aluno para reimprimir.";
  } catch {
    // Opening/closing a receipt tab never mutates financial state.
  }
}
