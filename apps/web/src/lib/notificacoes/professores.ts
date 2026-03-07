import type { Gatilho, Prioridade, TipoNotificacao } from "@/hooks/useNotificacoes";

export type ProfessorNotificacaoKey =
  | "CURRICULO_PUBLICADO"
  | "ANO_LETIVO_ACTIVADO"
  | "TURMA_ATRIBUIDA"
  | "ALUNO_MATRICULADO"
  | "ALUNO_TRANSFERIDO"
  | "ALUNO_CANCELADO"
  | "ALUNO_REINTEGRADO"
  | "PRAZO_NOTAS_3D"
  | "PRAZO_NOTAS_EXPIRADO";

export type ProfessorNotificacaoPayload = {
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
  turmaNome?: string | null;
  alunoNome?: string | null;
  actionUrl?: string | null;
};

type ProfessorNotificacaoTemplate = {
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

const PROFESSOR_NOTIFICACOES: Record<ProfessorNotificacaoKey, ProfessorNotificacaoTemplate> = {
  CURRICULO_PUBLICADO: {
    titulo: () => "Currículo publicado — disciplinas disponíveis",
    corpo: () => "O currículo foi publicado. Já pode preparar planos e conteúdos.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "curriculo_publicado_professor",
  },
  ANO_LETIVO_ACTIVADO: {
    titulo: () => "Novo ano lectivo activado",
    corpo: () => "Um novo ano lectivo foi activado. Verifique turmas e planos.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "ano_letivo_activado_professor",
  },
  TURMA_ATRIBUIDA: {
    titulo: ({ turmaNome }) => `Turma${turmaNome ? ` ${turmaNome}` : ""} atribuída a si`,
    corpo: () => "A turma foi atribuída ao seu perfil.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
    agrupamento_chave: "turma_atribuida_professor",
  },
  ALUNO_MATRICULADO: {
    titulo: ({ alunoNome }) => `Novo aluno matriculado${alunoNome ? `: ${alunoNome}` : ""}`,
    corpo: () => "Um novo aluno foi matriculado na sua turma.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
  },
  ALUNO_TRANSFERIDO: {
    titulo: ({ alunoNome }) => `Aluno transferido${alunoNome ? `: ${alunoNome}` : ""}`,
    corpo: () => "O aluno foi transferido para outra turma.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
  },
  ALUNO_CANCELADO: {
    titulo: ({ alunoNome }) => `Matrícula cancelada${alunoNome ? `: ${alunoNome}` : ""}`,
    corpo: () => "A matrícula do aluno foi cancelada.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
  },
  ALUNO_REINTEGRADO: {
    titulo: ({ alunoNome }) => `Aluno reintegrado${alunoNome ? `: ${alunoNome}` : ""}`,
    corpo: () => "O aluno foi reintegrado na turma.",
    prioridade: "info",
    gatilho: "H",
    tipo: "I",
  },
  PRAZO_NOTAS_3D: {
    titulo: () => "Prazo de lançamento de notas em 3 dias",
    corpo: () => "O prazo está a terminar. Finalize o lançamento de notas.",
    prioridade: "aviso",
    action_label: "Lançar notas",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "S",
    tipo: "A",
    modal_id: "lancamento_notas",
    agrupamento_chave: "prazo_notas_3d",
  },
  PRAZO_NOTAS_EXPIRADO: {
    titulo: () => "Prazo de lançamento de notas expirado",
    corpo: () => "O prazo expirou. Solicite extensão ao admin.",
    prioridade: "urgente",
    action_label: "Solicitar extensão",
    action_url: ({ actionUrl }) => actionUrl ?? null,
    gatilho: "S",
    tipo: "A",
    modal_id: "solicitar_extensao_notas",
    agrupamento_chave: "prazo_notas_expirado",
  },
};

export function buildProfessorNotificacao(
  key: ProfessorNotificacaoKey,
  params: TemplateParams = {}
): ProfessorNotificacaoPayload {
  const template = PROFESSOR_NOTIFICACOES[key];
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
