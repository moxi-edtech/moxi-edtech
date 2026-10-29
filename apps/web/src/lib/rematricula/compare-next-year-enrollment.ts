import { resolveClasseNumero } from "@/lib/rematricula/classe-numero";

/**
 * Administrative comparison only. A next-year enrollment is NOT evidence
 * of an academic outcome and may never be used to synthesize grades.
 */
export type TransitionAlert =
  | "DESTINO_SEM_VINCULO"
  | "VINCULO_DIVERGENTE"
  | "CLASSE_NAO_IDENTIFICADA"
  | "SALTO_DE_CLASSE"
  | "REGRESSAO_DE_CLASSE"
  | "REPETICAO_A_CONFIRMAR";

export type TransitionComparison = {
  alertas: TransitionAlert[];
  classe_origem: number | null;
  classe_destino: number | null;
  delta: number | null;
};

type Classe = { nome?: string | null; numero?: number | string | null } | null | undefined;

export function compareNextYearEnrollment(input: {
  matriculaOrigemId: string;
  classeOrigem: Classe;
  destino?: {
    origem_transicao_matricula_id?: string | null;
    classe: Classe;
  } | null;
}): TransitionComparison {
  const origin = resolveClasseNumero(input.classeOrigem);
  const target = input.destino ? resolveClasseNumero(input.destino.classe) : null;
  const alerts: TransitionAlert[] = [];
  if (!input.destino) return { alertas: alerts, classe_origem: origin, classe_destino: null, delta: null };

  if (input.destino.origem_transicao_matricula_id === null ||
      input.destino.origem_transicao_matricula_id === undefined) {
    alerts.push("DESTINO_SEM_VINCULO");
  } else if (input.destino.origem_transicao_matricula_id !== input.matriculaOrigemId) {
    alerts.push("VINCULO_DIVERGENTE");
  }

  if (origin === null || target === null) {
    alerts.push("CLASSE_NAO_IDENTIFICADA");
    return { alertas: alerts, classe_origem: origin, classe_destino: target, delta: null };
  }
  const delta = target - origin;
  if (delta > 1) alerts.push("SALTO_DE_CLASSE");
  else if (delta < 0) alerts.push("REGRESSAO_DE_CLASSE");
  else if (delta === 0) alerts.push("REPETICAO_A_CONFIRMAR");
  return { alertas: alerts, classe_origem: origin, classe_destino: target, delta };
}

/** Only a school-confirmed decision can justify this pairing. */
export function confirmedOutcomeFitsDestination(
  outcome: "aprovado" | "reprovado" | "concluido",
  comparison: TransitionComparison,
  hasDestination: boolean,
): boolean {
  if (!hasDestination) return true;
  if (comparison.delta === null) return false;
  if (outcome === "aprovado") return comparison.delta === 1;
  if (outcome === "reprovado") return comparison.delta === 0;
  return false; // Concluded studies must not silently retain an active destination.
}
