/**
 * Single source of truth for the application-side billing-window rule.
 *
 * The database remains the authority for persisted windows and trigger/RPC
 * enforcement. Route handlers must use these functions instead of rebuilding
 * month-boundary comparisons locally.
 */

export type BillingWindow = {
  dataInicio: string;
  dataFim: string;
  isClasseExame: boolean;
};

export type BillingCompetency = {
  ano: number;
  mes: number;
};

function monthStart(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}

export function billingCompetencyDate({ ano, mes }: BillingCompetency): Date {
  return new Date(Date.UTC(ano, mes - 1, 1));
}

export function billingWindowMonths(window: BillingWindow): { inicio: Date; fim: Date } {
  return {
    inicio: monthStart(window.dataInicio),
    fim: monthStart(window.dataFim),
  };
}

export function isBillingCompetencyAllowed(
  window: BillingWindow,
  competency: BillingCompetency,
): boolean {
  const { inicio, fim } = billingWindowMonths(window);
  const competencia = billingCompetencyDate(competency);

  if (competencia < inicio || competencia > fim) return false;

  // Regular classes do not generate/collect the final academic month.
  return window.isClasseExame || competencia < fim;
}

export function resolveTurmaBillingWindow({
  academicStart,
  academicEnd,
  customWindow,
  isClasseExame,
}: {
  academicStart: string;
  academicEnd: string;
  customWindow?: { data_inicio?: string | null; data_fim?: string | null } | null;
  isClasseExame: boolean;
}): BillingWindow {
  return {
    dataInicio: String(customWindow?.data_inicio || academicStart).slice(0, 10),
    dataFim: String(customWindow?.data_fim || academicEnd).slice(0, 10),
    isClasseExame,
  };
}

