/** Pure, oldest-first debt allocation. A batch is committed by one RPC. */
export function allocateDebtPayment<T extends { preco: number }>(
  mensalidades: readonly T[],
  valor: number,
): Array<{ item: T; amount: number }> {
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Valor de pagamento inválido.");
  const total = mensalidades.reduce((sum, item) => sum + item.preco, 0);
  if (valor > total) throw new Error("Pagamento superior à dívida.");

  let remaining = valor;
  const allocations: Array<{ item: T; amount: number }> = [];
  for (const item of mensalidades) {
    if (remaining <= 0) break;
    if (!Number.isFinite(item.preco) || item.preco <= 0) throw new Error("Mensalidade inválida.");
    const amount = Math.min(remaining, item.preco);
    allocations.push({ item, amount });
    remaining -= amount;
  }
  return allocations;
}

export function toDebtReceiptItems<T extends {
  id: string;
  nome: string;
  origem_matricula_id?: string | null;
}>(allocations: readonly { item: T; amount: number }[]) {
  return allocations.map(({ item, amount }) => ({
    id: item.id,
    tipo: "mensalidade" as const,
    nome: item.nome,
    preco: amount,
    origem_matricula_id: item.origem_matricula_id,
  }));
}
