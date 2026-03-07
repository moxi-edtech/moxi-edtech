import type { Gatilho, Prioridade, TipoNotificacao } from "@/hooks/useNotificacoes";

export type AdminNotificacaoKey =
  | "MANUTENCAO_PROGRAMADA"
  | "NOVA_FUNCIONALIDADE"
  | "LIMITE_ALUNOS_80"
  | "LIMITE_ALUNOS_100"
  | "SUBSCRICAO_EXPIRA_7"
  | "SUBSCRICAO_EXPIRADA";

export type AdminNotificacaoPayload = {
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
  dias?: number;
  percentual?: number;
  actionUrl?: string | null;
};

type AdminNotificacaoTemplate = {
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

const ADMIN_NOTIFICACOES: Record<AdminNotificacaoKey, AdminNotificacaoTemplate> = {
  MANUTENCAO_PROGRAMADA: {
    titulo: () => "Manutenção programada no sistema",
    corpo: () => "Haverá manutenção programada. Prepare a equipa para possíveis interrupções.",
    prioridade: "aviso",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "sistema_manutencao",
  },
  NOVA_FUNCIONALIDADE: {
    titulo: () => "Nova funcionalidade disponível",
    corpo: () => "Uma nova funcionalidade foi activada para a sua escola.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "sistema_nova_funcionalidade",
  },
  LIMITE_ALUNOS_80: {
    titulo: ({ percentual }) => `Limite de alunos a ${percentual ?? 80}% do plano`,
    corpo: () => "Considere fazer upgrade do plano para evitar bloqueio.",
    prioridade: "aviso",
    action_label: "Ver planos",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "S",
    tipo: "A",
    modal_id: "ver_planos_upgrade",
    agrupamento_chave: "plano_limite_80",
  },
  LIMITE_ALUNOS_100: {
    titulo: () => "Limite de alunos a 100% — bloqueado",
    corpo: () => "O plano actual atingiu o limite. Upgrade obrigatório para continuar.",
    prioridade: "urgente",
    action_label: "Fazer upgrade",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "S",
    tipo: "A",
    modal_id: "upgrade_obrigatorio",
    agrupamento_chave: "plano_limite_100",
  },
  SUBSCRICAO_EXPIRA_7: {
    titulo: ({ dias }) => `Subscrição expira em ${dias ?? 7} dias`,
    corpo: () => "Renove a subscrição para evitar bloqueios de acesso.",
    prioridade: "aviso",
    action_label: "Renovar",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "S",
    tipo: "A",
    modal_id: "renovar_subscricao",
    agrupamento_chave: "subscricao_expira",
  },
  SUBSCRICAO_EXPIRADA: {
    titulo: () => "Subscrição expirada — acesso limitado",
    corpo: () => "A subscrição expirou. Renove para restaurar o acesso completo.",
    prioridade: "urgente",
    action_label: "Renovar",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "S",
    tipo: "A",
    modal_id: "renovar_subscricao",
    agrupamento_chave: "subscricao_expirada",
  },
};

export function buildAdminNotificacao(
  key: AdminNotificacaoKey,
  params: TemplateParams = {}
): AdminNotificacaoPayload {
  const template = ADMIN_NOTIFICACOES[key];
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
