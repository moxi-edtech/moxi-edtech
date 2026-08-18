export type AlunoServicoFinanceiro = {
  id: string;
  pagamento_id: string;
  protocolo: string;
  nome: string;
  valor: number;
  status: "pago" | "pendente" | "em_verificacao" | "rejeitado" | "cancelado" | "erro";
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

type ServiceStatus = AlunoServicoFinanceiro["status"];

function serviceState(rawStatus: string, source: "pagamento" | "pedido"): ServiceStatus {
  const raw = rawStatus.toLowerCase();
  if (["settled", "confirmed", "concluido", "pago", "paid", "succeeded", "approved", "granted"].includes(raw)) return "pago";
  if (["rejected", "rejeitado", "declined"].includes(raw)) return "rejeitado";
  if (["canceled", "cancelled", "cancelado"].includes(raw)) return "cancelado";
  if (["failed", "falhou", "erro", "error"].includes(raw)) return "erro";
  if (source === "pedido" && ["pending_payment", "draft"].includes(raw)) return "pendente";
  return "em_verificacao";
}

function serviceContext(status: ServiceStatus, isDocumentService: boolean) {
  return {
    estado_label: {
      pago: "Pagamento confirmado",
      pendente: "Pagamento pendente",
      em_verificacao: "Em validação",
      rejeitado: "Comprovativo rejeitado",
      cancelado: "Pagamento cancelado",
      erro: "Erro no processamento",
    }[status],
    mensagem_estado: {
      pago: "O pagamento foi registado pela escola.",
      pendente: "O serviço foi solicitado, mas o pagamento ainda não foi concluído.",
      em_verificacao: "O comprovativo foi recebido e aguarda validação da secretaria.",
      rejeitado: "A secretaria não validou este comprovativo.",
      cancelado: "Este pagamento foi cancelado e não está activo.",
      erro: "O pagamento não foi concluído correctamente.",
    }[status],
    proximo_passo: {
      pago: "Nenhuma ação necessária.",
      pendente: isDocumentService ? "Abra a Secretaria Digital para concluir o pagamento." : "Contacte a secretaria para concluir o pagamento.",
      em_verificacao: "Aguarde a validação da secretaria.",
      rejeitado: isDocumentService ? "Reveja o motivo e envie um novo comprovativo." : "Contacte a secretaria para corrigir este serviço.",
      cancelado: isDocumentService ? "Solicite o serviço novamente, se ainda precisar dele." : "Contacte a secretaria para solicitar novamente.",
      erro: isDocumentService ? "Tente novamente ou contacte a secretaria se o erro persistir." : "Contacte a secretaria para concluir este serviço.",
    }[status],
  };
}

function serviceAction(status: ServiceStatus, serviceCode: string | null) {
  if (!serviceCode || status === "pago" || status === "em_verificacao" || !serviceCode.startsWith("DOC_")) return null;
  return {
    label: status === "rejeitado" ? "Reenviar comprovativo" : status === "pendente" ? "Concluir pagamento" : "Solicitar novamente",
    href: `/aluno/documentos?servico=${encodeURIComponent(serviceCode)}`,
  };
}

export function extractServicosFromPagamentos(
  pagamentos: Array<{ id: string; status?: string | null; created_at?: string | null; meta?: unknown }>,
): AlunoServicoFinanceiro[] {
  return pagamentos.flatMap((pagamento) => {
    const meta = asRecord(pagamento.meta);
    const rawItems = meta.itens_pagamento ?? meta.itens;
    if (!Array.isArray(rawItems)) return [];

    const status = serviceState(String(pagamento.status ?? ""), "pagamento");
    const servicoCodigo = typeof meta.servico_codigo === "string" ? meta.servico_codigo : null;
    const isDocumentService = Boolean(servicoCodigo?.startsWith("DOC_"));
    const { estado_label: estadoLabel, mensagem_estado: mensagemEstado, proximo_passo: proximoPasso } = serviceContext(status, isDocumentService);
    const acao = serviceAction(status, servicoCodigo);
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

export function extractServicosFromPedidos(
  pedidos: Array<{ id: string; status?: string | null; servico_codigo?: string | null; servico_nome?: string | null; valor_cobrado?: number | null; created_at?: string | null }>,
): AlunoServicoFinanceiro[] {
  return pedidos.flatMap((pedido) => {
    const nome = pedido.servico_nome?.trim();
    if (!nome) return [];
    const servicoCodigo = pedido.servico_codigo ?? null;
    const status = serviceState(String(pedido.status ?? ""), "pedido");
    const isDocumentService = Boolean(servicoCodigo?.startsWith("DOC_"));
    const { estado_label, mensagem_estado, proximo_passo } = serviceContext(status, isDocumentService);
    return [{
      id: `pedido-${pedido.id}`,
      pagamento_id: pedido.id,
      protocolo: pedido.id.slice(0, 8).toUpperCase(),
      nome,
      valor: Number(pedido.valor_cobrado ?? 0),
      status,
      estado_label,
      mensagem_estado,
      proximo_passo,
      servico_codigo: servicoCodigo,
      acao: serviceAction(status, servicoCodigo),
      data: pedido.created_at ?? new Date().toISOString(),
    }];
  });
}
