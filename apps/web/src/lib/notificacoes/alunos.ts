import type { Gatilho, Prioridade, TipoNotificacao } from "@/hooks/useNotificacoes";

export type AlunoNotificacaoKey =
  | "MATRICULA_CONFIRMADA"
  | "DOCUMENTO_EMITIDO"
  | "NOTA_LANCADA"
  | "AVALIACAO_MARCADA"
  | "FALTA_REGISTADA"
  | "FALTAS_LIMITE"
  | "NOTA_BAIXA"
  | "RENOVACAO_DISPONIVEL"
  | "PROPINA_ATRASO"
  | "PROPINA_VENCE_3D";

export type AlunoNotificacaoPayload = {
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
  disciplinaNome?: string | null;
  data?: string | null;
  faltas?: number | null;
  dias?: number;
  actionUrl?: string | null;
};

type AlunoNotificacaoTemplate = {
  titulo: (params: TemplateParams) => string;
  corpo?: (params: TemplateParams) => string | null;
  prioridade: Prioridade;
  action_label?: string | null;
  action_url?: (params: TemplateParams) => string | null;
  gatilho: Gatilho;
  tipo: TipoNotificacao;
  modal_id?: string | null;
  agrupamento_chave?: (params: TemplateParams) => string | null;
};

const ALUNO_NOTIFICACOES: Record<AlunoNotificacaoKey, AlunoNotificacaoTemplate> = {
  MATRICULA_CONFIRMADA: {
    titulo: () => "Matrícula confirmada",
    corpo: () => "A matrícula foi confirmada pela secretaria.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
  },
  DOCUMENTO_EMITIDO: {
    titulo: () => "Documento emitido — disponível para levantamento",
    corpo: () => "O documento está disponível na área de documentos.",
    prioridade: "info",
    action_label: "Ver documentos",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: () => "documento_emitido",
  },
  NOTA_LANCADA: {
    titulo: ({ disciplinaNome }) => `Nota lançada — ${disciplinaNome ?? "disciplina"}`,
    corpo: () => "Uma nova nota foi registada.",
    prioridade: "info",
    action_label: "Ver notas",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: ({ disciplinaNome }) => `nota_lancada_${disciplinaNome ?? "geral"}`,
  },
  AVALIACAO_MARCADA: {
    titulo: ({ disciplinaNome, data }) =>
      `Avaliação marcada — ${disciplinaNome ?? "disciplina"}${data ? ` (${data})` : ""}`,
    corpo: () => "Foi marcada uma nova avaliação.",
    prioridade: "info",
    action_label: "Ver detalhes",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: ({ disciplinaNome }) => `avaliacao_marcada_${disciplinaNome ?? "geral"}`,
  },
  FALTA_REGISTADA: {
    titulo: () => "Falta registada",
    corpo: () => "Uma falta foi registada.",
    prioridade: "info",
    action_label: "Ver histórico",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: () => "falta_registada",
  },
  FALTAS_LIMITE: {
    titulo: ({ faltas }) => `Faltas a atingir limite — ${faltas ?? 0} faltas registadas`,
    corpo: () => "O número de faltas está próximo do limite.",
    prioridade: "aviso",
    action_label: "Ver histórico",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "S",
    tipo: "A",
    modal_id: "faltas_limite",
    agrupamento_chave: () => "faltas_limite",
  },
  NOTA_BAIXA: {
    titulo: ({ disciplinaNome }) => `Nota abaixo da média — ${disciplinaNome ?? "disciplina"}`,
    corpo: () => "Uma nota abaixo da média foi registada.",
    prioridade: "aviso",
    action_label: "Ver notas",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "S",
    tipo: "I",
    agrupamento_chave: ({ disciplinaNome }) => `nota_baixa_${disciplinaNome ?? "geral"}`,
  },
  RENOVACAO_DISPONIVEL: {
    titulo: () => "Renovação de matrícula disponível",
    corpo: () => "A renovação está disponível. Inicie o processo quando estiver pronto.",
    prioridade: "aviso",
    action_label: "Iniciar renovação",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "S",
    tipo: "A",
    modal_id: "renovar_matricula",
    agrupamento_chave: () => "renovacao_disponivel",
  },
  PROPINA_ATRASO: {
    titulo: ({ dias }) => `Propina em atraso — ${dias ?? 0} dias`,
    corpo: () => "Existe uma propina em atraso. Regularize o pagamento.",
    prioridade: "aviso",
    action_label: "Ver detalhe",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "S",
    tipo: "A",
    modal_id: "propina_atraso",
    agrupamento_chave: () => "propina_atraso",
  },
  PROPINA_VENCE_3D: {
    titulo: () => "Propina vence em 3 dias — lembrete",
    corpo: () => "A propina vence em 3 dias. Evite atrasos.",
    prioridade: "info",
    gatilho: "S",
    tipo: "I",
    agrupamento_chave: () => "propina_vence_3d",
  },
};

export function buildAlunoNotificacao(
  key: AlunoNotificacaoKey,
  params: TemplateParams = {}
): AlunoNotificacaoPayload {
  const template = ALUNO_NOTIFICACOES[key];
  return {
    titulo: template.titulo(params),
    corpo: template.corpo ? template.corpo(params) : null,
    prioridade: template.prioridade,
    action_label: template.action_label ?? null,
    action_url: template.action_url ? template.action_url(params) : null,
    gatilho: template.gatilho,
    tipo: template.tipo,
    modal_id: template.modal_id ?? null,
    agrupamento_chave: template.agrupamento_chave ? template.agrupamento_chave(params) : null,
  };
}
