export const PORTAL_DOCUMENT_TYPES = {
  DOC_DECLARACAO_FREQUENCIA: "declaracao_frequencia",
  DOC_DECLARACAO_NOTAS: "declaracao_notas",
  DOC_COMPROVANTE_MATRICULA: "comprovante_matricula",
  DOC_CARTAO_ESTUDANTE: "cartao_estudante",
  DOC_FICHA_INSCRICAO: "ficha_inscricao",
  DOC_HISTORICO_ESCOLAR: "historico",
  DOC_CERTIFICADO_HABILITACOES: "certificado",
} as const;
export function portalDocumentType(code: string): string | null {
  return Object.prototype.hasOwnProperty.call(PORTAL_DOCUMENT_TYPES, code)
    ? PORTAL_DOCUMENT_TYPES[code as keyof typeof PORTAL_DOCUMENT_TYPES] : null;
}
export const DOCUMENT_BLOCK_REASONS: Record<string,string> = {
  HISTORICO_INEXISTENTE: "O histórico deste ano letivo ainda não está disponível.",
  HISTORICO_ABERTO: "O histórico deste ano letivo ainda não foi fechado.",
  NOTAS_INEXISTENTES: "As classificações deste ano ainda não estão disponíveis.",
  NOTAS_INCOMPLETAS: "As classificações deste ano precisam de regularização.",
  MATRICULA_INATIVA: "Este documento exige uma matrícula ativa.",
  MATRICULA_NAO_ENCONTRADA: "Não existe matrícula elegível no ano escolhido.",
  TAXA_NAO_CONFIGURADA: "A escola ainda não definiu a taxa deste documento.",
  SERVICO_NAO_CONFIGURADO: "Este serviço não está disponível.",
};
