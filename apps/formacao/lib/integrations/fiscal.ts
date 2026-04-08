export type FiscalEmissionInput = {
  escolaId: string;
  tipoDocumento: "FT" | "FR" | "RC";
  referencia: string;
  total: number;
  clienteNome: string;
};

export async function emitFiscalDocumento(input: FiscalEmissionInput) {
  // Adapter fino para manter apps/formacao desacoplado e permitir trocar backend depois.
  const response = await fetch("/api/fiscal/documentos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((json as { error?: { message?: string } } | null)?.error?.message || "Falha fiscal");
  }

  return json;
}
