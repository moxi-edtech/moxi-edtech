/**
 * Modelo comercial CRM, baseado na Proposta Comercial — Makuntima Zinga
 * (26/09/2026). Capacidade alinhada com app_plan_limits / landing.ts.
 * Preços e concessões são negociados no CRM, nunca inferidos do plano.
 */
export type ProposalPlan = "essencial" | "profissional" | "premium";

export const PROPOSAL_PLANS: Record<ProposalPlan, {
  label: string;
  alunos: number | null;
  utilizadores: number | null;
  storage: string;
  network: string;
  suporte: string;
}> = {
  essencial: {
    label: "Essencial", alunos: 600, utilizadores: 10, storage: "5 GB",
    network: "KLASSE Network: leitura", suporte: "Suporte por e-mail conforme plano contratado",
  },
  profissional: {
    label: "Profissional", alunos: 1500, utilizadores: 30, storage: "20 GB",
    network: "KLASSE Network: leitura + contribuição", suporte: "Suporte por e-mail e chat conforme plano contratado",
  },
  premium: {
    label: "Premium", alunos: null, utilizadores: null, storage: "100 GB+",
    network: "KLASSE Network completo", suporte: "Suporte dedicado conforme condições contratadas",
  },
};

const EDUCATION_LEVELS: Record<string, string> = {
  primario: "Ensino Primário",
  ciclo1: "I Ciclo do Ensino Secundário",
  puniv: "Ensino Secundário Geral / PUNIV",
  tecnico: "Ensino Técnico",
};

function safeNonnegativeInteger(raw: string | null): number | null {
  if (raw === null || !/^[0-9]+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export function readProposalParams(params: URLSearchParams) {
  const rawPlan = params.get("plano");
  const plano: ProposalPlan | null = rawPlan === "essencial" || rawPlan === "profissional" || rawPlan === "premium"
    ? rawPlan : null;
  const escola = (params.get("escola") || "").trim().slice(0, 180);
  const contacto = (params.get("contacto") || "").trim().slice(0, 180);
  const alunos = safeNonnegativeInteger(params.get("alunos"));
  const taxa = safeNonnegativeInteger(params.get("taxa"));
  const mensalidade = safeNonnegativeInteger(params.get("mensalidade"));
  const trial = safeNonnegativeInteger(params.get("trial"));
  const niveis = [...new Set((params.get("niveis") || "").split(",").filter((v) => Object.prototype.hasOwnProperty.call(EDUCATION_LEVELS, v)))]
    .map((v) => EDUCATION_LEVELS[v]);
  return { plano, escola, contacto, alunos, taxa, mensalidade, trial, niveis };
}

export type CommercialProposal = ReturnType<typeof readProposalParams>;

export function formatNumber(value: number): string {
  // Uniformizar a apresentação impressa angolana: 140.000 em vez de 140 000.
  return value.toLocaleString("pt-PT").replace(/[\u00a0\u202f\s]/g, ".");
}

export function formatKz(value: number | null): string {
  return value === null ? "A definir" : "Kz " + formatNumber(value);
}

export function proposalPrintErrors(data: CommercialProposal): string[] {
  const errors: string[] = [];
  if (!data.escola) errors.push("Indique a escola.");
  if (!data.plano) errors.push("Selecione um plano válido.");
  if (data.alunos === null || data.alunos < 1) errors.push("Indique o número estimado de alunos.");
  if (data.taxa === null) errors.push("Indique a taxa de ativação (0 para isenção).");
  if (data.mensalidade === null || data.mensalidade < 1) errors.push("Indique uma mensalidade válida.");
  if (data.trial === null || data.trial > 30) errors.push("O período de teste deve estar entre 0 e 30 dias.");
  if (data.plano && data.alunos !== null) {
    const limite = PROPOSAL_PLANS[data.plano].alunos;
    if (limite !== null && data.alunos > limite) {
      errors.push("O plano " + PROPOSAL_PLANS[data.plano].label + " admite até " + formatNumber(limite) + " alunos.");
    }
  }
  if (data.mensalidade !== null && data.taxa !== null && !Number.isSafeInteger(data.mensalidade + data.taxa)) {
    errors.push("O pagamento inicial ultrapassa o limite numérico permitido.");
  }
  return errors;
}
