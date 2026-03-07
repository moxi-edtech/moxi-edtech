import type { Gatilho, Prioridade, TipoNotificacao } from "@/hooks/useNotificacoes";

export type SecretariaNotificacaoKey =
  | "TURMA_APROVADA"
  | "TURMA_REJEITADA"
  | "PROPINA_DEFINIDA"
  | "DESCONTO_APROVADO"
  | "IMPORTACAO_ALUNOS_CONCLUIDA";

export type SecretariaNotificacaoPayload = {
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
  total?: number;
  alunoNome?: string | null;
  anoLetivo?: number | null;
  actionUrl?: string | null;
};

type SecretariaNotificacaoTemplate = {
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

const SECRETARIA_NOTIFICACOES: Record<SecretariaNotificacaoKey, SecretariaNotificacaoTemplate> = {
  TURMA_APROVADA: {
    titulo: () => "Turma aprovada — pronta para matrículas",
    corpo: () => "A turma foi aprovada pelo admin e já pode receber matrículas.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "turma_aprovada",
  },
  TURMA_REJEITADA: {
    titulo: () => "Turma rejeitada — motivo indicado",
    corpo: () => "O admin rejeitou a turma. Revise o motivo e ajuste os dados.",
    prioridade: "aviso",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "turma_rejeitada",
  },
  PROPINA_DEFINIDA: {
    titulo: ({ anoLetivo }) => `Nova propina definida — entra em vigor em ${anoLetivo ?? "mês futuro"}`,
    corpo: () => "Nova tabela de preços definida pelo admin. Confirme a comunicação aos encarregados.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "propina_definida",
  },
  DESCONTO_APROVADO: {
    titulo: ({ alunoNome }) => `Isenção ou desconto aprovado${alunoNome ? ` para ${alunoNome}` : ""}`,
    corpo: () => "A isenção foi aprovada pelo admin. Actualize o registo financeiro se necessário.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "desconto_aprovado",
  },
  IMPORTACAO_ALUNOS_CONCLUIDA: {
    titulo: ({ total }) => `Importação de alunos concluída — ${total ?? 0} alunos para processar`,
    corpo: () => "Clique para rever a lista e confirmar matrículas pendentes.",
    prioridade: "aviso",
    action_label: "Ver lista",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "H",
    tipo: "A",
    modal_id: "confirmar_matriculas_importacao",
    agrupamento_chave: "importacao_alunos_concluida",
  },
};

export function buildSecretariaNotificacao(
  key: SecretariaNotificacaoKey,
  params: TemplateParams = {}
): SecretariaNotificacaoPayload {
  const template = SECRETARIA_NOTIFICACOES[key];
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
