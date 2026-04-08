export type PaymentIntentInput = {
  escolaId: string;
  referencia: string;
  valor: number;
  moeda?: string;
};

export async function createPaymentIntent(input: PaymentIntentInput) {
  // Adapter de pagamento partilhado por produto via endpoint central.
  const response = await fetch("/api/financeiro/pagamentos/registrar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((json as { error?: string } | null)?.error || "Falha ao criar pagamento");
  }

  return json;
}
