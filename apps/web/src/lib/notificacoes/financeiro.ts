import type { Gatilho, Prioridade, TipoNotificacao } from "@/hooks/useNotificacoes";

export type FinanceiroNotificacaoKey =
  | "CATALOGO_PRECOS_ATIVADO"
  | "FECHO_AUTORIZADO"
  | "DESCONTO_APROVADO";

export type FinanceiroNotificacaoPayload = {
  titulo: string;
  corpo?: string | null;
  prioridade: Prioridade;
  action_label?: string | null;
  action_url?: string | null;
  gatilho: Gatilho;
  tipo: TipoNotificacao;
  modal_id?: string | null;
  agrupamento_chave?: string | null;
};

type TemplateParams = {
  alunoNome?: string | null;
  actionUrl?: string | null;
};

type FinanceiroNotificacaoTemplate = {
  titulo: (params: TemplateParams) => string;
  corpo?: (params: TemplateParams) => string | null;
  prioridade: Prioridade;
  action_label?: string | null;
  action_url?: (params: TemplateParams) => string | null;
  gatilho: Gatilho;
  tipo: TipoNotificacao;
  modal_id?: string | null;
  agrupamento_chave?: string | null;
};

const FINANCEIRO_NOTIFICACOES: Record<FinanceiroNotificacaoKey, FinanceiroNotificacaoTemplate> = {
  CATALOGO_PRECOS_ATIVADO: {
    titulo: () => "Novo catálogo de preços activado",
    corpo: () => "O admin activou um novo catálogo de preços. Revise o impacto financeiro.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "catalogo_precos_ativado",
  },
  FECHO_AUTORIZADO: {
    titulo: () => "Encerramento de período financeiro autorizado",
    corpo: () => "O admin autorizou o fecho. Confirme e gere o relatório.",
    prioridade: "aviso",
    action_label: "Confirmar fecho",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "H",
    tipo: "A",
    modal_id: "confirmar_fecho_financeiro",
    agrupamento_chave: "fecho_financeiro_autorizado",
  },
  DESCONTO_APROVADO: {
    titulo: ({ alunoNome }) => `Desconto aprovado${alunoNome ? ` para ${alunoNome}` : ""}`,
    corpo: () => "O admin aprovou um desconto. Ajuste o lançamento financeiro.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "desconto_aprovado_financeiro",
  },
};

export function buildFinanceiroNotificacao(
  key: FinanceiroNotificacaoKey,
  params: TemplateParams = {}
): FinanceiroNotificacaoPayload {
  const template = FINANCEIRO_NOTIFICACOES[key];
  return {
    titulo: template.titulo(params),
    corpo: template.corpo ? template.corpo(params) : null,
    prioridade: template.prioridade,
    action_label: template.action_label ?? null,
    action_url: template.action_url ? template.action_url(params) : null,
    gatilho: template.gatilho,
    tipo: template.tipo,
    modal_id: template.modal_id ?? null,
    agrupamento_chave: template.agrupamento_chave ?? null,
  };
}
