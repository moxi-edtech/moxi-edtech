type Format = "excel" | "pdf";

/** Same-origin authenticated download; never download an HTML error page as a document. */
export async function downloadAlunosExport(
  url: string,
  format: Format,
  fallbackFilename: string,
  init?: RequestInit
): Promise<void> {
  const target = new URL(url, window.location.origin);
  if (target.origin !== window.location.origin) throw new Error("Destino de exportação inválido.");
  let response: Response;
  try {
    response = await fetch(target, { ...init, cache: "no-store", credentials: "same-origin" });
  } catch {
    throw new Error("Não foi possível contactar o servidor. Verifique a ligação e tente novamente.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const reference = typeof body?.requestId === "string" ? ` (Ref. ${body.requestId})` : "";
    if (response.status === 401) throw new Error("A sessão expirou. Entre novamente.");
    if (response.status === 403) throw new Error("Sem permissão para exportar esta lista.");
    if (response.status === 504) throw new Error("A exportação excedeu o tempo de resposta. Tente novamente ou refine os filtros." + reference);
    if (response.status === 400 && typeof body?.error === "string") throw new Error(body.error);
    throw new Error(`Não foi possível exportar a lista (HTTP ${response.status}).${reference}`);
  }
  const expected = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (!response.headers.get("content-type")?.toLowerCase().startsWith(expected)) {
    throw new Error("O servidor não devolveu o documento solicitado. Verifique a sessão e tente novamente.");
  }
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("O documento devolvido está vazio.");
  const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? fallbackFilename;
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Safari/mobile needs the object URL to remain valid after dispatching the click.
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}
