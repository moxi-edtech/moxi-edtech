// -----------------------------------------------------------------------------
//  1. CONSTANTES DE STRINGS (DEDUPLICAÇÃO)
// -----------------------------------------------------------------------------
const DISC = {
  PT: "Língua Portuguesa",
  MAT: "Matemática",
  EMC: "Educação Moral e Cívica",
  EF: "Educação Física",
  EST_MEIO: "Estudo do Meio",
  CN: "Ciências da Natureza",
  HGA: "História e Geografia de Angola",
  FIS: "Física",
  QUI: "Química",
  BIO: "Biologia",
  HIST: "História",
  GEO: "Geografia",
  DGD: "Desenho e Geometria Descritiva",
  ECON: "Economia",
  CONT_G: "Contabilidade Geral",
  DIR_INTRO: "Introdução ao Direito",
  GEO_ECO: "Geografia Económica",
  DIR_OBR: "Direito das Obrigações",
  DIR_COM: "Direito Comercial",
  FIL_INTRO: "Introdução à Filosofia",
  PSICO_INTRO: "Introdução à Psicologia",
  FIL: "Filosofia",
  PSICO: "Psicologia",
  SOCIO: "Sociologia",

  // Técnicos – Informática
  INF_INTRO: "Introdução à Informática",
  LOGICA: "Lógica de Programação",
  ARQ_COMP: "Arquitetura de Computadores",
  REDES: "Redes de Computadores",
  SO: "Sistemas Operativos",
  POO: "Programação Orientada a Objetos",
  BD: "Bases de Dados",
  WEB: "Programação Web",
  SI: "Sistemas de Informação",
  SEG_INF: "Segurança Informática",
  GEST_PROJ: "Gestão de Projectos TI",
  PROJ_TEC: "Projecto Tecnológico",
  ESTAGIO: "Estágio Curricular",

  // Técnicos – Gestão
  GEST_INTRO: "Introdução à Gestão",
  CONT_AN: "Contabilidade Analítica",
  GEST_RH: "Gestão de Recursos Humanos",
  FISCAL: "Fiscalidade",
  GEST_FIN: "Gestão Financeira",
  GEST_COM_MKT: "Gestão Comercial e Marketing",
  INFO_GEST: "Informática de Gestão",
  GEST_ESTR: "Gestão Estratégica",
  AUD_CONTROLO: "Auditoria e Controlo",
  PROJ_GEST: "Projecto de Gestão",

  // Técnicos – Construção
  DESENHO_TEC: "Desenho Técnico",
  MAT_CONST: "Materiais de Construção",
  TOPOGRAFIA: "Topografia",
  RES_MAT: "Resistência dos Materiais",
  TEC_CONST: "Tecnologias da Construção",
  INST_PRED: "Instalações Prediais",
  ESTRUTURAS: "Estruturas",
  GEST_OBRAS: "Gestão de Obras",
  ORC_CUSTOS: "Orçamentação e Custos",
  SEG_HIG: "Segurança e Higiene no Trabalho",
  LEG_CONST: "Legislação da Construção",
  PROJ_CONST: "Projecto de Construção",

  // Técnicos – Enfermagem
  ANAT_FISIO: "Anatomia e Fisiologia",
  FUND_ENF: "Fundamentos de Enfermagem",
  MICRO_PARASITO: "Microbiologia e Parasitologia",
  ENF_MED: "Enfermagem Médica",
  ENF_CIR: "Enfermagem Cirúrgica",
  FARMACO: "Farmacologia",
  ENF_COMUNIT: "Enfermagem Comunitária",
  SAUDE_MI: "Saúde Materno-Infantil",
  NUT_DIET: "Nutrição e Dietética",
  URG_EMERG: "Urgências e Emergências",
  SAUDE_MENTAL: "Saúde Mental",
  GEST_ENF: "Gestão em Enfermagem",

  // Técnicos – Análises Clínicas
  QUIM_GERAL: "Química Geral",
  ANALISES_INTRO: "Introdução às Análises Clínicas",
  MICROBIO: "Microbiologia",
  PARASITO: "Parasitologia",
  BIOQ_CLIN: "Bioquímica Clínica",
  HEMATO: "Hematologia",
  IMUNO: "Imunologia",
  BACTERIO: "Bacteriologia",
  TOXICO: "Toxicologia",
  GEST_LAB: "Gestão Laboratorial",
  CONTROLO_QUAL: "Controlo de Qualidade",
} as const;

const CLASSES = {
  C10: "10ª Classe",
  C11: "11ª Classe",
  C12: "12ª Classe",
  C13: "13ª Classe",
} as const;

// -----------------------------------------------------------------------------
//  2. TIPAGENS
// -----------------------------------------------------------------------------

export type CurriculumKey =
  | "pre_escolar"
  | "primario_i"
  | "primario_ii"
  | "secundario_i"
  | "secundario_ii_fb"
  | "secundario_ii_ej"
  | "secundario_ii_hs"
  | "tecnico_informatica"
  | "tecnico_gestao"
  | "tecnico_construcao"
  | "tecnico_enfermagem"
  | "tecnico_analises_clinicas";

export type NivelEnsinoId =
  | "pre_escolar"
  | "primario_i"
  | "primario_ii"
  | "secundario_i"
  | "secundario_ii"
  | "tecnico";

export type CurriculumDisciplineBlueprint = Readonly<{
  nome: string;
  classe: string;
  nivel: NivelEnsinoId;
  curso?: string;
  tipo?: "core" | "eletivo" | "especifica";
}>;

// -----------------------------------------------------------------------------
//  3. HELPERS
// -----------------------------------------------------------------------------

const d = (
  nome: string,
  classe: string,
  nivel: NivelEnsinoId,
  extra?: Partial<CurriculumDisciplineBlueprint>,
): CurriculumDisciplineBlueprint => ({ nome, classe, nivel, ...extra });

const grid = (
  classes: readonly string[],
  nivel: NivelEnsinoId,
  nomes: readonly string[],
): CurriculumDisciplineBlueprint[] =>
  classes.flatMap((c) => nomes.map((n) => d(n, c, nivel)));

// -----------------------------------------------------------------------------
//  4. DATA STORE – PRESETS COMPLETOS
// -----------------------------------------------------------------------------

const _PRESETS: Record<
  CurriculumKey,
  readonly CurriculumDisciplineBlueprint[]
> = {
  // ---------------------------------------------------------------------------
  // PRÉ-ESCOLAR
  // ---------------------------------------------------------------------------
  pre_escolar: grid(
    ["Creche", "Pré-Escolar"],
    "pre_escolar",
    ["Educação Pré-Escolar"],
  ),

  // ---------------------------------------------------------------------------
  // PRIMÁRIO I (1ª–4ª)
  // ---------------------------------------------------------------------------
  primario_i: grid(
    ["1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe"],
    "primario_i",
    [
      DISC.PT,
      DISC.MAT,
      DISC.EST_MEIO,
      DISC.EMC,
      DISC.EF,
    ],
  ),

  // ---------------------------------------------------------------------------
  // PRIMÁRIO II (5ª–6ª)
  // ---------------------------------------------------------------------------
  primario_ii: grid(
    ["5ª Classe", "6ª Classe"],
    "primario_ii",
    [
      DISC.PT,
      DISC.MAT,
      DISC.CN,
      DISC.HGA,
      DISC.EMC,
      DISC.EF,
    ],
  ),

  // ---------------------------------------------------------------------------
  // SECUNDÁRIO I (7ª–9ª)
  // ---------------------------------------------------------------------------
  secundario_i: grid(
    ["7ª Classe", "8ª Classe", "9ª Classe"],
    "secundario_i",
    [
      DISC.PT,
      DISC.MAT,
      DISC.FIS,
      DISC.QUI,
      DISC.BIO,
      DISC.HIST,
      DISC.GEO,
      DISC.EF,
    ],
  ),

  // ---------------------------------------------------------------------------
  // SECUNDÁRIO II – Ciências Físico-Biológicas
  // ---------------------------------------------------------------------------
  secundario_ii_fb: [
    // PT, MAT, FIS, QUI, BIO, EF – 10ª, 11ª, 12ª
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12],
      "secundario_ii",
      [DISC.PT, DISC.MAT, DISC.FIS, DISC.QUI, DISC.BIO, DISC.EF],
    ),
    // DGD – só 10ª e 11ª
    ...grid([CLASSES.C10, CLASSES.C11], "secundario_ii", [DISC.DGD]),
  ].map((x) => ({ ...x, curso: "Ciências Físico-Biológicas" })),

  // ---------------------------------------------------------------------------
  // SECUNDÁRIO II – Ciências Económicas e Jurídicas
  // ---------------------------------------------------------------------------
  secundario_ii_ej: [
    // PT, MAT, ECON, CONT_G, EF – 10ª, 11ª, 12ª
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12],
      "secundario_ii",
      [DISC.PT, DISC.MAT, DISC.ECON, DISC.CONT_G, DISC.EF],
    ),
    d(DISC.DIR_INTRO, CLASSES.C10, "secundario_ii"),
    d(DISC.GEO_ECO, CLASSES.C10, "secundario_ii"),
    d(DISC.DIR_OBR, CLASSES.C11, "secundario_ii"),
    d(DISC.GEO_ECO, CLASSES.C11, "secundario_ii"),
    d(DISC.DIR_COM, CLASSES.C12, "secundario_ii"),
  ].map((x) => ({ ...x, curso: "Ciências Económicas e Jurídicas" })),

  // ---------------------------------------------------------------------------
  // SECUNDÁRIO II – Ciências Humanas e Sociais
  // ---------------------------------------------------------------------------
  secundario_ii_hs: [
    // PT, MAT, HIST, GEO, EF – 10ª, 11ª, 12ª
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12],
      "secundario_ii",
      [DISC.PT, DISC.MAT, DISC.HIST, DISC.GEO, DISC.EF],
    ),
    // Introduções – 10ª
    d(DISC.FIL_INTRO, CLASSES.C10, "secundario_ii"),
    d(DISC.PSICO_INTRO, CLASSES.C10, "secundario_ii"),
    // Filosofia, Psicologia, Sociologia – 11ª e 12ª
    ...grid(
      [CLASSES.C11, CLASSES.C12],
      "secundario_ii",
      [DISC.FIL, DISC.PSICO, DISC.SOCIO],
    ),
  ].map((x) => ({ ...x, curso: "Ciências Humanas e Sociais" })),

  // ---------------------------------------------------------------------------
  // TÉCNICO – Informática
  // ---------------------------------------------------------------------------
  tecnico_informatica: [
    // PT – 10ª–13ª
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13],
      "tecnico",
      [DISC.PT],
    ),
    // MAT – 10ª–12ª
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12],
      "tecnico",
      [DISC.MAT],
    ),
    // Específicas
    d(DISC.INF_INTRO, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.LOGICA, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.ARQ_COMP, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.REDES, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.SO, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.POO, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.BD, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.WEB, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.SI, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.SEG_INF, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.GEST_PROJ, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.PROJ_TEC, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.ESTAGIO, CLASSES.C13, "tecnico", { tipo: "especifica" }),
  ].map((x) => ({ ...x, curso: "Técnico de Informática" })),

  // ---------------------------------------------------------------------------
  // TÉCNICO – Gestão
  // ---------------------------------------------------------------------------
  tecnico_gestao: [
    // PT, MAT – 10ª, 11ª, 12ª
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12],
      "tecnico",
      [DISC.PT, DISC.MAT],
    ),
    // PT – 13ª
    d(DISC.PT, CLASSES.C13, "tecnico"),
    // Específicas
    d(DISC.GEST_INTRO, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.CONT_G, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.ECON, CLASSES.C10, "tecnico"),
    d(DISC.GEST_RH, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.CONT_AN, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.FISCAL, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.GEST_FIN, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.GEST_COM_MKT, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.INFO_GEST, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.GEST_ESTR, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.AUD_CONTROLO, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.PROJ_GEST, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.ESTAGIO, CLASSES.C13, "tecnico", { tipo: "especifica" }),
  ].map((x) => ({ ...x, curso: "Técnico de Gestão" })),

  // ---------------------------------------------------------------------------
  // TÉCNICO – Construção Civil
  // ---------------------------------------------------------------------------
  tecnico_construcao: [
    // PT, MAT – 10ª, 11ª, 12ª
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12],
      "tecnico",
      [DISC.PT, DISC.MAT],
    ),
    // PT – 13ª
    d(DISC.PT, CLASSES.C13, "tecnico"),
    // Específicas
    d(DISC.DESENHO_TEC, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.MAT_CONST, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.TOPOGRAFIA, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.RES_MAT, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.TEC_CONST, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.INST_PRED, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.ESTRUTURAS, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.GEST_OBRAS, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.ORC_CUSTOS, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.SEG_HIG, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.LEG_CONST, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.PROJ_CONST, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.ESTAGIO, CLASSES.C13, "tecnico", { tipo: "especifica" }),
  ].map((x) => ({ ...x, curso: "Técnico de Construção Civil" })),

  // ---------------------------------------------------------------------------
  // TÉCNICO – Enfermagem
  // ---------------------------------------------------------------------------
  tecnico_enfermagem: [
    // PT, MAT – 10ª–13ª
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13],
      "tecnico",
      [DISC.PT, DISC.MAT],
    ),
    // Específicas
    d(DISC.ANAT_FISIO, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.FUND_ENF, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.MICRO_PARASITO, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.ENF_MED, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.ENF_CIR, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.FARMACO, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.ENF_COMUNIT, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.SAUDE_MI, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.NUT_DIET, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.URG_EMERG, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.SAUDE_MENTAL, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.GEST_ENF, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.ESTAGIO, CLASSES.C13, "tecnico", { tipo: "especifica" }),
  ].map((x) => ({ ...x, curso: "Técnico de Enfermagem" })),

  // ---------------------------------------------------------------------------
  // TÉCNICO – Análises Clínicas
  // ---------------------------------------------------------------------------
  tecnico_analises_clinicas: [
    // PT, MAT – 10ª–13ª
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13],
      "tecnico",
      [DISC.PT, DISC.MAT],
    ),
    // Específicas
    d(DISC.ANAT_FISIO, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.QUIM_GERAL, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.ANALISES_INTRO, CLASSES.C10, "tecnico", { tipo: "especifica" }),
    d(DISC.MICROBIO, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.PARASITO, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.BIOQ_CLIN, CLASSES.C11, "tecnico", { tipo: "especifica" }),
    d(DISC.HEMATO, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.IMUNO, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.BACTERIO, CLASSES.C12, "tecnico", { tipo: "especifica" }),
    d(DISC.TOXICO, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.GEST_LAB, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.CONTROLO_QUAL, CLASSES.C13, "tecnico", { tipo: "especifica" }),
    d(DISC.ESTAGIO, CLASSES.C13, "tecnico", { tipo: "especifica" }),
  ].map((x) => ({ ...x, curso: "Técnico de Análises Clínicas" })),
};

export const CURRICULUM_PRESETS: Record<
  CurriculumKey,
  readonly CurriculumDisciplineBlueprint[]
> = Object.freeze(_PRESETS);

// -----------------------------------------------------------------------------
//  5. META DOS PRESETS
// -----------------------------------------------------------------------------

export interface CurriculumPresetMeta {
  readonly key: CurriculumKey;
  readonly label: string;
  readonly description?: string;
  readonly badge?: string;
  readonly recommended?: boolean;
  readonly subjectsCount: number;
  readonly classes: readonly string[];
  readonly idadeMin?: number;
  readonly idadeMax?: number;
  readonly duracaoAnos?: number;
  readonly tipo: string;
  readonly configuracao_turmas?: {
    padrao: '1_por_combinacao' | '2_por_combinacao' | 'personalizado';
    capacidade_padrao: number;
    nomenclatura_padrao: 'descritivo_completo' | 'descritivo_simples' | 'abreviado';
  };
}

// Info de nível / faixa etária conforme combinámos
const LEVEL_INFO: Record<
  CurriculumKey,
  {
    idadeMin?: number;
    idadeMax?: number;
    duracaoAnos?: number;
    tipo: string;
    configuracao_turmas?: {
        padrao: '1_por_combinacao' | '2_por_combinacao' | 'personalizado';
        capacidade_padrao: number;
        nomenclatura_padrao: 'descritivo_completo' | 'descritivo_simples' | 'abreviado';
    };
  }
> = {
  pre_escolar: { idadeMin: 3, idadeMax: 5, duracaoAnos: 3, tipo: "Pré-Escolar", configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 20, nomenclatura_padrao: 'descritivo_simples' } },
  primario_i: { idadeMin: 6, idadeMax: 9, duracaoAnos: 4, tipo: "Primário I", configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 30, nomenclatura_padrao: 'descritivo_simples' } },
  primario_ii: { idadeMin: 10, idadeMax: 11, duracaoAnos: 2, tipo: "Primário II", configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 30, nomenclatura_padrao: 'descritivo_simples' } },
  secundario_i: { idadeMin: 12, idadeMax: 14, duracaoAnos: 3, tipo: "Secundário I", configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 35, nomenclatura_padrao: 'descritivo_completo' } },
  secundario_ii_fb: {
    idadeMin: 15,
    idadeMax: 17,
    duracaoAnos: 3,
    tipo: "Secundário II - FB",
    configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 35, nomenclatura_padrao: 'descritivo_completo' }
  },
  secundario_ii_ej: {
    idadeMin: 15,
    idadeMax: 17,
    duracaoAnos: 3,
    tipo: "Secundário II - EJ",
    configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 35, nomenclatura_padrao: 'descritivo_completo' }
  },
  secundario_ii_hs: {
    idadeMin: 15,
    idadeMax: 17,
    duracaoAnos: 3,
    tipo: "Secundário II - HS",
    configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 35, nomenclatura_padrao: 'descritivo_completo' }
  },
  tecnico_informatica: { idadeMin: 15, duracaoAnos: 4, tipo: "Técnico", configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 30, nomenclatura_padrao: 'abreviado' } },
  tecnico_gestao: { idadeMin: 15, duracaoAnos: 4, tipo: "Técnico", configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 30, nomenclatura_padrao: 'abreviado' } },
  tecnico_construcao: { idadeMin: 15, duracaoAnos: 4, tipo: "Técnico", configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 30, nomenclatura_padrao: 'abreviado' } },
  tecnico_enfermagem: { idadeMin: 17, duracaoAnos: 4, tipo: "Técnico de Saúde", configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 25, nomenclatura_padrao: 'abreviado' } },
  tecnico_analises_clinicas: {
    idadeMin: 17,
    duracaoAnos: 4,
    tipo: "Técnico de Saúde",
    configuracao_turmas: { padrao: '1_por_combinacao', capacidade_padrao: 25, nomenclatura_padrao: 'abreviado' }
  },
};

// Texto/UI base (sem campos derivados)
const CURRICULUM_PRESETS_META_BASE: Array<
  Omit<
    CurriculumPresetMeta,
    "subjectsCount" | "classes" | "idadeMin" | "idadeMax" | "duracaoAnos" | "tipo"
  >
> = [
  {
    key: "pre_escolar",
    label: "Pré-Escolar",
    description: "Educação infantil para crianças de 3 a 5 anos. (Em construção)",
    badge: "Pré-Escolar",
    recommended: false,
  },
  {
    key: "primario_i",
    label: "Ensino Primário I Ciclo",
    description: "1ª a 4ª classe - Educação básica obrigatória.",
    badge: "Primário",
    recommended: true,
  },
  {
    key: "primario_ii",
    label: "Ensino Primário II Ciclo",
    description: "5ª e 6ª classe - Conclusão do ensino primário.",
    badge: "Primário",
    recommended: true,
  },
  {
    key: "secundario_i",
    label: "Ensino Secundário I Ciclo",
    description: "7ª a 9ª classe - Ensino secundário geral.",
    badge: "Secundário",
    recommended: true,
  },
  {
    key: "secundario_ii_fb",
    label: "Ciências Físico-Biológicas",
    description: "10ª a 12ª classe - Foco em Física, Química, Biologia.",
    badge: "Secundário II",
    recommended: true,
  },
  {
    key: "secundario_ii_ej",
    label: "Ciências Económicas e Jurídicas",
    description: "10ª a 12ª classe - Foco em Economia, Direito, Contabilidade.",
    badge: "Secundário II",
    recommended: false,
  },
  {
    key: "secundario_ii_hs",
    label: "Ciências Humanas e Sociais",
    description: "10ª a 12ª classe - Foco em História, Geografia, Psicologia.",
    badge: "Secundário II",
    recommended: false,
  },
  {
    key: "tecnico_informatica",
    label: "Técnico de Informática",
    description: "Curso técnico de 4 anos (10ª-13ª) com foco em TI.",
    badge: "Técnico",
    recommended: true,
  },
  {
    key: "tecnico_gestao",
    label: "Técnico de Gestão",
    description: "Curso técnico de 4 anos (10ª-13ª) em gestão empresarial.",
    badge: "Técnico",
    recommended: true,
  },
  {
    key: "tecnico_construcao",
    label: "Técnico de Construção Civil",
    description: "Curso técnico de 4 anos (10ª-13ª) em construção civil.",
    badge: "Técnico",
    recommended: true,
  },
  {
    key: "tecnico_enfermagem",
    label: "Técnico de Enfermagem",
    description: "Curso técnico de 4 anos (10ª-13ª) em enfermagem.",
    badge: "Saúde",
    recommended: true,
  },
  {
    key: "tecnico_analises_clinicas",
    label: "Técnico de Análises Clínicas",
    description: "Curso técnico de 4 anos (10ª-13ª) em análises clínicas.",
    badge: "Saúde",
    recommended: true,
  },
];

// cache de classes únicas por preset
const CLASSES_CACHE: Record<CurriculumKey, readonly string[]> = Object.freeze(
  Object.fromEntries(
    (Object.keys(CURRICULUM_PRESETS) as CurriculumKey[]).map((key) => {
      const set = new Set<string>();
      CURRICULUM_PRESETS[key].forEach((disc) => set.add(disc.classe));
      return [key, Object.freeze(Array.from(set))];
    }),
  ) as Record<CurriculumKey, readonly string[]>,
);

// Construção final das metas
export const CURRICULUM_PRESETS_META: Record<
  CurriculumKey,
  CurriculumPresetMeta
> = Object.freeze(
  Object.fromEntries(
    CURRICULUM_PRESETS_META_BASE.map((base) => {
      const key = base.key;
      const level = LEVEL_INFO[key];
      const subjectsCount = CURRICULUM_PRESETS[key].length;
      const classes = CLASSES_CACHE[key];
      const meta: CurriculumPresetMeta = {
        ...base,
        ...level,
        key,
        subjectsCount,
        classes,
      };
      return [key, meta];
    }),
  ) as Record<CurriculumKey, CurriculumPresetMeta>,
);

// -----------------------------------------------------------------------------
//  6. API PÚBLICA
// -----------------------------------------------------------------------------

export const getPresetMeta = (key: CurriculumKey): CurriculumPresetMeta =>
  CURRICULUM_PRESETS_META[key];

export const getAllPresetsMeta = (): CurriculumPresetMeta[] =>
  (Object.keys(CURRICULUM_PRESETS_META) as CurriculumKey[]).map(
    (k) => CURRICULUM_PRESETS_META[k],
  );

export const getSubjectsCount = (key: CurriculumKey): number =>
  CURRICULUM_PRESETS[key]?.length ?? 0;

export const getPresetsByLevel = (nivel: NivelEnsinoId): CurriculumKey[] =>
  (Object.entries(CURRICULUM_PRESETS) as [
    CurriculumKey,
    readonly CurriculumDisciplineBlueprint[],
  ][])
    .filter(([, discs]) => discs[0]?.nivel === nivel)
    .map(([key]) => key);

export const getAgeRangeForPreset = (
  key: CurriculumKey,
): { min?: number; max?: number } => {
  const meta = CURRICULUM_PRESETS_META[key];
  return { min: meta.idadeMin, max: meta.idadeMax };
};

export const getDurationForPreset = (
  key: CurriculumKey,
): number | undefined => CURRICULUM_PRESETS_META[key].duracaoAnos;
