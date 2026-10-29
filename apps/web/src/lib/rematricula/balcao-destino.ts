import type { ProgressaoBalcao } from "@/hooks/useRematriculaBalcao";

/**
 * Repetição por retenção académica (RAA: retido/mesma_etapa) também permite
 * escolher uma turma destino. Faltas, indisciplina, recurso e dados pendentes
 * continuam sem autorização de matrícula.
 */
export function canSelectRematriculaDestination(
  progressao: Pick<ProgressaoBalcao, "estado" | "modo"> | null,
  turmaId: string | null,
): boolean {
  if (!progressao || !turmaId) return false;
  return (progressao.estado === "aprovado" && progressao.modo === "promocao")
    || (progressao.estado === "condicional" && progressao.modo === "promocao")
    || (progressao.estado === "reprovado" && progressao.modo === "retencao");
}
