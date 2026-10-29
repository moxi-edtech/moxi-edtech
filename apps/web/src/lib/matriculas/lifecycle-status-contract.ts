/**
 * Labels and public codes of the database lifecycle projection v2.
 * Never derive approval, retention or academic scores from a class transition.
 */
export const SITUACOES_MATRICULA = {
  rascunho: "Matrícula em preparação",
  aguarda_confirmacao: "Aguardando confirmação de matrícula",
  matriculado: "Matrícula confirmada",
  ano_encerrado: "Matrícula do ano encerrada",
  regularizacao_historica: "Histórico anterior por regularizar",
  transferido: "Transferência registada",
  trancado: "Matrícula trancada",
  desistente: "Desistência registada",
  anulado: "Matrícula anulada",
  revisao_integridade: "Revisão de integridade necessária",
} as const;

export type SituacaoMatriculaContextual = keyof typeof SITUACOES_MATRICULA;
export type SituacaoResultadoContextual =
  | "homologado" | "registado_nao_homologado" | "sem_resultado_oficial";
export type AcaoMatriculaContextual =
  | "conciliar_historico" | "confirmar_matricula" | "completar_matricula"
  | "acompanhar_ano" | "consultar_historico" | "homologar_resultado"
  | "rever_integridade" | "consultar_movimento";

export function isSituacaoMatriculaContextual(value: unknown): value is SituacaoMatriculaContextual {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SITUACOES_MATRICULA, value);
}
export function rotuloSituacaoMatricula(value: SituacaoMatriculaContextual): string {
  return SITUACOES_MATRICULA[value];
}
export function isSituacaoResultadoContextual(value: unknown): value is SituacaoResultadoContextual {
  return value === "homologado" || value === "registado_nao_homologado"
    || value === "sem_resultado_oficial";
}
export function isAcaoMatriculaContextual(value: unknown): value is AcaoMatriculaContextual {
  return ["conciliar_historico", "confirmar_matricula", "completar_matricula",
    "acompanhar_ano", "consultar_historico", "homologar_resultado",
    "rever_integridade", "consultar_movimento"].includes(String(value));
}
export function textoResultadoAcademico(
  situacao: SituacaoResultadoContextual, resultadoOficial: string | null,
): string {
  if (situacao === "homologado" && resultadoOficial) return `Resultado oficial: ${resultadoOficial}`;
  if (situacao === "registado_nao_homologado") return "Resultado registado, ainda não homologado";
  return "Resultado académico ainda não oficializado";
}
