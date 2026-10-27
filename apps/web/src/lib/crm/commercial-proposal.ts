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

/** Catálogos únicos usados pelo formulário comercial e pelo documento impresso. */
export const PROPOSAL_LEVEL_OPTIONS = [
  { value: "pre_escolar", label: "Educação Pré-Escolar" },
  { value: "primario", label: "Ensino Primário" },
  { value: "ciclo1", label: "I Ciclo do Ensino Secundário" },
  { value: "puniv", label: "Ensino Secundário Geral / PUNIV" },
  { value: "tecnico", label: "Ensino Técnico" },
] as const;

export const PROPOSAL_PRESET_OPTIONS = [
  { value: "pre_escolar", label: "Educação Pré-Escolar" },
  { value: "primario_generico", label: "Ensino Primário (1ª à 6ª Classe)" },
  { value: "esg_ciclo1", label: "I Ciclo do Ensino Secundário (7ª à 9ª Classe)" },
  { value: "esg_puniv_cfb", label: "PUNIV — Ciências Físicas e Biológicas" },
  { value: "esg_puniv_cej", label: "PUNIV — Ciências Económicas e Jurídicas" },
  { value: "esg_puniv_cch", label: "PUNIV — Ciências Sociais e Humanas" },
  { value: "tec_informatica", label: "Técnico de Informática" },
  { value: "tec_contabilidade", label: "Técnico de Contabilidade" },
  { value: "tec_informatica_gestao", label: "Técnico de Informática de Gestão" },
  { value: "tec_saude_enfermagem", label: "Técnico de Enfermagem" },
  { value: "tec_saude_analises", label: "Técnico de Análises Clínicas" },
] as const;

type ProposalContact = { nome: string; email: string; telefone: string };
function readContact(params: URLSearchParams, prefix: string): ProposalContact {
  return {
    nome: (params.get(prefix + "_nome") || "").trim().slice(0, 180),
    email: (params.get(prefix + "_email") || "").trim().slice(0, 180),
    telefone: (params.get(prefix + "_telefone") || "").trim().slice(0, 80),
  };
}

const EDUCATION_LEVELS: Record<string, string> = Object.fromEntries(
  PROPOSAL_LEVEL_OPTIONS.map(({ value, label }) => [value, label]),
);
const CURRICULAR_PRESETS: Record<string, string> = Object.fromEntries(
  PROPOSAL_PRESET_OPTIONS.map(({ value, label }) => [value, label]),
);

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
  const codigosNiveis = [...new Set((params.get("niveis") || "").split(",").map((v) => v.trim()).filter(Boolean))];
  const niveisDesconhecidos = codigosNiveis.filter((v) => !Object.prototype.hasOwnProperty.call(EDUCATION_LEVELS, v));
  const niveis = codigosNiveis.filter((v) => Object.prototype.hasOwnProperty.call(EDUCATION_LEVELS, v))
    .map((v) => EDUCATION_LEVELS[v]);
  const presetCode = (params.get("preset") || "").trim();
  const preset = CURRICULAR_PRESETS[presetCode] || null;
  const presetDesconhecido = Boolean(presetCode && !preset);
  return {
    plano, escola, contacto, alunos, taxa, mensalidade, trial,
    niveis, niveisDesconhecidos, preset, presetDesconhecido,
    contactos: {
      secretaria: readContact(params, "secretaria"),
      financeiro: readContact(params, "financeiro"),
      pedagogico: readContact(params, "pedagogico"),
    },
  };
}

export type CommercialProposal = ReturnType<typeof readProposalParams>;

export function formatNumber(value: number): string {
  // Uniformizar a apresentação impressa angolana: 140.000 em vez de 140 000.
  return new Intl.NumberFormat("en-US").format(value).replace(/,/g, ".");
}

export function formatKz(value: number | null): string {
  return value === null ? "A definir" : "Kz " + formatNumber(value);
}

export function proposalPrintErrors(data: CommercialProposal): string[] {
  const errors: string[] = [];
  if (!data.escola) errors.push("Indique a escola.");
  if (data.niveisDesconhecidos.length > 0) errors.push("Os níveis de ensino selecionados não são reconhecidos pelo catálogo atual.");
  if (data.presetDesconhecido) errors.push("O modelo curricular selecionado não é reconhecido pelo catálogo atual.");
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
