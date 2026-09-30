export const AGT_CERTIFICATION_TIME_ZONE = "Africa/Luanda";

export const AGT_CERTIFICATION_REQUIRED_LOCAL_SERIES = [
  "PP",
  "GR",
  "GT",
] as const;

export const AGT_CERTIFICATION_REQUIRED_FE_SERIES = [
  "FT",
  "NC",
  "ND",
  "RC",
  "FG",
] as const;

export const AGT_CERTIFICATION_REQUIRED_TAX_PROFILES = [
  "IVA_NORMAL_14_AO",
  "IVA_EDUCACAO_M21",
] as const;

export type AgtCertificationPoint =
  | "P01"
  | "P02"
  | "P03"
  | "P04"
  | "P05"
  | "P06"
  | "P07"
  | "P08"
  | "P09"
  | "P10"
  | "P11"
  | "P12"
  | "P13"
  | "P14"
  | "P15"
  | "P16"
  | "P17";

export type AgtCertificationPlanItem = {
  point: AgtCertificationPoint;
  title: string;
  documentTypes: readonly string[];
  execution: "emit" | "reuse-or-emit" | "na-candidate" | "package";
  notes?: string;
};

export const AGT_CERTIFICATION_PLAN: readonly AgtCertificationPlanItem[] = [
  {
    point: "P01",
    title: "Fatura para cliente identificado com NIF",
    documentTypes: ["FT"],
    execution: "emit",
  },
  {
    point: "P02",
    title: "Fatura anulada com evidência antes/depois",
    documentTypes: ["FT"],
    execution: "emit",
  },
  {
    point: "P03",
    title: "Documento de conferência / fatura pró-forma",
    documentTypes: ["PP"],
    execution: "reuse-or-emit",
  },
  {
    point: "P04",
    title: "Fatura baseada na pró-forma com OrderReferences",
    documentTypes: ["PP", "FT"],
    execution: "reuse-or-emit",
  },
  {
    point: "P05",
    title: "Nota de crédito baseada na fatura do P04",
    documentTypes: ["FT", "NC"],
    execution: "reuse-or-emit",
  },
  {
    point: "P06",
    title: "Documento com linha tributada e linha isenta",
    documentTypes: ["FT"],
    execution: "emit",
  },
  {
    point: "P07",
    title: "100 x 0,55 com desconto de linha 8,8% e desconto global",
    documentTypes: ["FT"],
    execution: "emit",
  },
  {
    point: "P08",
    title: "Documento em moeda estrangeira",
    documentTypes: ["FT"],
    execution: "reuse-or-emit",
  },
  {
    point: "P09",
    title: "Cliente identificado sem NIF, total inferior a 50 AOA e SystemEntryDate antes das 10h",
    documentTypes: ["FT"],
    execution: "emit",
    notes: "Nunca alterar/backdate SystemEntryDate; executar somente na janela real de Luanda.",
  },
  {
    point: "P10",
    title: "Outro cliente identificado sem NIF",
    documentTypes: ["FT"],
    execution: "emit",
  },
  {
    point: "P11",
    title: "Duas guias de remessa/transporte",
    documentTypes: ["GR", "GT"],
    execution: "emit",
  },
  {
    point: "P12",
    title: "Orçamento ou fatura pró-forma",
    documentTypes: ["PP"],
    execution: "reuse-or-emit",
  },
  {
    point: "P13",
    title: "Fatura genérica / auto-faturação",
    documentTypes: [],
    execution: "na-candidate",
    notes: "KLASSE não expõe GF/auto-faturação no contrato atual; justificar N/A em vez de criar feature artificial.",
  },
  {
    point: "P14",
    title: "Fatura global",
    documentTypes: ["FG"],
    execution: "emit",
  },
  {
    point: "P15",
    title: "Outros tipos realmente emitidos pela aplicação",
    documentTypes: ["ND", "RC"],
    execution: "emit",
    notes: "RE só deve entrar se permanecer no escopo comercial declarado do produto.",
  },
  {
    point: "P16",
    title: "Matriz ponto → documento/evidência",
    documentTypes: [],
    execution: "package",
  },
  {
    point: "P17",
    title: "SAF-T único contendo os exemplos do dossiê",
    documentTypes: [],
    execution: "package",
  },
] as const;

function luandaParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AGT_CERTIFICATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    date: `${map.get("year")}-${map.get("month")}-${map.get("day")}`,
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
    second: Number(map.get("second")),
  };
}

export function resolveP09Window(now = new Date()) {
  const local = luandaParts(now);
  const eligible = Number.isInteger(local.hour) && local.hour >= 0 && local.hour < 10;

  return {
    timeZone: AGT_CERTIFICATION_TIME_ZONE,
    localDate: local.date,
    localTime: [
      String(local.hour).padStart(2, "0"),
      String(local.minute).padStart(2, "0"),
      String(local.second).padStart(2, "0"),
    ].join(":"),
    eligible,
  };
}

export function requiredFeSeriesTypes(options?: { includeRe?: boolean }) {
  return options?.includeRe
    ? [...AGT_CERTIFICATION_REQUIRED_FE_SERIES, "RE"]
    : [...AGT_CERTIFICATION_REQUIRED_FE_SERIES];
}
