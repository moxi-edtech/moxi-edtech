export type AlunoServicoFinanceiro = {
  id: string;
  pagamento_id: string;
  protocolo: string;
  nome: string;
  valor: number;
  status: string;
  estado_label: string;
  mensagem_estado: string;
  proximo_passo: string;
  servico_codigo: string | null;
  acao: { label: string; href: string } | null;
  data: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function extractServicosFromPagamentos(
  pagamentos: Array<{ id: string; status?: string | null; created_at?: string | null; meta?: unknown }>,
): AlunoServicoFinanceiro[] {
  return pagamentos.flatMap((pagamento) => {
    const meta = asRecord(pagamento.meta);
    const rawItems = meta.itens_pagamento ?? meta.itens;
    if (!Array.isArray(rawItems)) return [];

    const status = ["settled", "confirmed", "concluido", "pago", "paid", "succeeded", "approved"].includes(String(pagamento.status ?? "").toLowerCase())
      ? "pago"
      : "pendente";
    const estadoLabel = status === "pago" ? "Pagamento confirmado" : "Em validação";
    const mensagemEstado = status === "pago"
      ? "O pagamento foi registado pela escola."
      : "O comprovativo ou pagamento ainda precisa de validação da secretaria.";
    const proximoPasso = status === "pago"
      ? "Nenhuma ação necessária."
      : "Aguarde a validação ou contacte a secretaria se precisar de ajuda.";
    const servicoCodigo = typeof meta.servico_codigo === "string" ? meta.servico_codigo : null;
    const acao = status === "pago" || !servicoCodigo
      ? null
      : { label: "Abrir Secretaria Digital", href: `/aluno/documentos?servico=${encodeURIComponent(servicoCodigo)}` };
    const data = pagamento.created_at ?? new Date().toISOString();

    return rawItems.flatMap((rawItem, index) => {
      const item = asRecord(rawItem);
      if (item.tipo === "mensalidade") return [];

      const nome = item.nome ?? item.descricao ?? item.referencia ?? item.label;
      const valor = Number(item.preco ?? item.valor ?? item.amount ?? 0);
      if (typeof nome !== "string" || !nome.trim() || !Number.isFinite(valor)) return [];

      return [{
        id: `${pagamento.id}-${index}`,
        pagamento_id: pagamento.id,
        protocolo: pagamento.id.slice(0, 8).toUpperCase(),
        nome: nome.trim(),
        valor,
        status,
        estado_label: estadoLabel,
        mensagem_estado: mensagemEstado,
        proximo_passo: proximoPasso,
        servico_codigo: servicoCodigo,
        acao,
        data,
      }];
    });
  });
}
