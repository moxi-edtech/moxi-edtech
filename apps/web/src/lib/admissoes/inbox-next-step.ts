/**
 * Próxima ação operacional para cada estado da candidatura.
 *
 * Fonte única da orientação exibida na fila e no detalhe do Inbox.
 * Nenhuma ação mutável é executada por este módulo: a UI encaminha a ação
 * para os handlers autorizados e confirma as decisões no fluxo existente.
 */
export const ADMISSION_INBOX_STATUSES = [
  'rascunho',
  'pre_candidatura',
  'submetida',
  'documentos_reenviados',
  'em_analise',
  'aprovada',
  'aguardando_pagamento',
  'aguardando_compensacao',
  'rejeitada',
  'arquivada',
  'arquivado',
  'matriculado',
  'pendente',
  'lista_espera',
] as const;

export type AdmissionInboxStatus = (typeof ADMISSION_INBOX_STATUSES)[number];

export type AdmissionInboxAction =
  | 'share_link'
  | 'promote'
  | 'review_documents'
  | 'review_history'
  | 'approve'
  | 'accept_documents'
  | 'convert'
  | 'next_candidate';

export type AdmissionInboxNextStep = {
  title: string;
  description: string;
  action: AdmissionInboxAction;
  actionLabel: string;
  listLabel: string;
};

const STEPS: Record<AdmissionInboxStatus, AdmissionInboxNextStep> = {
  rascunho: {
    title: 'Aguardar envio da candidatura',
    description: 'O candidato ainda não submeteu o pedido. Partilhe o link para concluir a inscrição.',
    action: 'share_link',
    actionLabel: 'Copiar link de inscrição',
    listLabel: 'Aguardar envio',
  },
  pre_candidatura: {
    title: 'Preparar candidatura oficial',
    description: 'Escolha uma turma do ano letivo preparado para continuar o atendimento.',
    action: 'promote',
    actionLabel: 'Promover candidatura',
    listLabel: 'Promover para candidatura',
  },
  submetida: {
    title: 'Rever candidatura',
    description: 'Confirme os documentos antes de decidir pela aprovação ou pela correção.',
    action: 'review_documents',
    actionLabel: 'Rever documentos',
    listLabel: 'Rever documentos',
  },
  documentos_reenviados: {
    title: 'Documentos recebidos novamente',
    description: 'Confira os ficheiros atualizados antes de os aceitar ou pedir novos ajustes.',
    action: 'review_documents',
    actionLabel: 'Rever documentos',
    listLabel: 'Conferir documentos',
  },
  em_analise: {
    title: 'Concluir análise',
    description: 'Reveja a documentação e escolha aprovar ou solicitar correção.',
    action: 'review_documents',
    actionLabel: 'Rever documentos',
    listLabel: 'Concluir análise',
  },
  aprovada: {
    title: 'Concluir matrícula',
    description: 'Confirme a turma e os dados do candidato antes de efetivar a matrícula.',
    action: 'convert',
    actionLabel: 'Efetivar matrícula',
    listLabel: 'Efetivar matrícula',
  },
  aguardando_pagamento: {
    title: 'Confirmar pagamento',
    description: 'Registe um pagamento efetivamente recebido para continuar a matrícula.',
    action: 'convert',
    actionLabel: 'Registar pagamento e matricular',
    listLabel: 'Registar pagamento',
  },
  aguardando_compensacao: {
    title: 'Validar comprovativo',
    description: 'Confira a compensação do pagamento antes de concluir a matrícula.',
    action: 'convert',
    actionLabel: 'Validar pagamento e matricular',
    listLabel: 'Validar pagamento',
  },
  rejeitada: {
    title: 'Candidatura rejeitada',
    description: 'O processo está encerrado. Pode atender outro candidato ou reabrir pelo menu de ações.',
    action: 'next_candidate',
    actionLabel: 'Atender próximo',
    listLabel: 'Processo encerrado',
  },
  arquivada: {
    title: 'Candidatura arquivada',
    description: 'O processo permanece disponível para consulta e pode ser reaberto quando necessário.',
    action: 'next_candidate',
    actionLabel: 'Atender próximo',
    listLabel: 'Processo arquivado',
  },
  arquivado: {
    title: 'Candidatura arquivada',
    description: 'O processo permanece disponível para consulta e pode ser reaberto quando necessário.',
    action: 'next_candidate',
    actionLabel: 'Atender próximo',
    listLabel: 'Processo arquivado',
  },
  matriculado: {
    title: 'Matrícula concluída',
    description: 'O atendimento foi concluído. Pode continuar a consultar este processo ou atender outro candidato.',
    action: 'next_candidate',
    actionLabel: 'Atender próximo',
    listLabel: 'Atendimento concluído',
  },
  pendente: {
    title: 'Aguardar correção dos documentos',
    description: 'O pedido de correção já foi enviado. Acompanhe os documentos e o histórico sem repetir a solicitação.',
    action: 'review_documents',
    actionLabel: 'Ver documentos em falta',
    listLabel: 'Aguardar correção',
  },
  lista_espera: {
    title: 'Rever vaga e matrícula',
    description: 'Escolha uma turma com vaga. A confirmação da matrícula verifica capacidade, autorização e pagamento.',
    action: 'convert',
    actionLabel: 'Rever turma e matricular',
    listLabel: 'Verificar vaga',
  },
};

const REVIEWED_DOCUMENTS: Partial<Record<AdmissionInboxStatus, AdmissionInboxNextStep>> = {
  submetida: {
    title: 'Documentação em revisão',
    description: 'Se os documentos estiverem corretos, confirme a aprovação; caso contrário, peça ajustes.',
    action: 'approve',
    actionLabel: 'Aprovar candidatura',
    listLabel: 'Rever documentos',
  },
  em_analise: {
    title: 'Decidir candidatura',
    description: 'Se os documentos estiverem corretos, confirme a aprovação; caso contrário, peça ajustes.',
    action: 'approve',
    actionLabel: 'Aprovar candidatura',
    listLabel: 'Concluir análise',
  },
  documentos_reenviados: {
    title: 'Conferir e aceitar documentos',
    description: 'Se a documentação reenviada estiver correta, aceite-a para devolver o pedido à fila de análise.',
    action: 'accept_documents',
    actionLabel: 'Aceitar documentos',
    listLabel: 'Conferir documentos',
  },
  pendente: {
    title: 'Acompanhar pendência',
    description: 'Os documentos continuam pendentes de correção pelo candidato. Consulte as atualizações no histórico.',
    action: 'review_history',
    actionLabel: 'Ver histórico',
    listLabel: 'Aguardar correção',
  },
};

// Nunca apresentar uma ação mutável para um estado desconhecido.
const UNKNOWN_STEP: AdmissionInboxNextStep = {
  title: 'Rever situação da candidatura',
  description: 'Consulte o histórico antes de tomar uma decisão.',
  action: 'review_history',
  actionLabel: 'Ver histórico',
  listLabel: 'Verificar situação',
};

export function getAdmissionInboxNextStep(
  status: string | null | undefined,
  detailTab: 'resumo' | 'documentos' | 'historico' = 'resumo',
): AdmissionInboxNextStep {
  if (!status || !Object.prototype.hasOwnProperty.call(STEPS, status)) {
    return UNKNOWN_STEP;
  }

  const current = status as AdmissionInboxStatus;
  if (detailTab === 'documentos' && REVIEWED_DOCUMENTS[current]) {
    return REVIEWED_DOCUMENTS[current]!;
  }

  return STEPS[current];
}
