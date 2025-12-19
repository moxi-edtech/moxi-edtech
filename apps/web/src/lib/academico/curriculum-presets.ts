const DISC = {
  PT: "Língua Portuguesa",
  ING: "Língua Estrangeira",
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
  DESENHO_TEC: "Desenho Técnico",
  MAT_CONST: "Materiais de Construção",
  TOPOGRAFIA: "Topografia",
  RES_MAT: "Resistência dos Materiais",
  TEC_CONST: "Tecnologia da Construção",
  INST_PRED: "Instalações Prediais",
  ESTRUTURAS: "Estruturas",
  GEST_OBRAS: "Gestão de Obras",
  ORC_CUSTOS: "Orçamentos e Custos",
  SEG_HIG: "Segurança e Higiene",
  LEG_CONST: "Legislação da Construção",
  PROJ_CONST: "Projecto de Construção",
} as const;

const CLASSES = {
  C1: "1ª Classe",
  C2: "2ª Classe",
  C3: "3ª Classe",
  C4: "4ª Classe",
  C5: "5ª Classe",
  C6: "6ª Classe",
  C7: "7ª Classe",
  C8: "8ª Classe",
  C9: "9ª Classe",
  C10: "10ª Classe",
  C11: "11ª Classe",
  C12: "12ª Classe",
  C13: "13ª Classe",
} as const;

export type CurriculumKey =
  | "primario_base"
  | "primario_avancado"
  | "ciclo1"
  | "puniv"
  | "economicas"
  | "tecnico_informatica"
  | "tecnico_gestao"
  | "tecnico_construcao"
  | "tecnico_base"
  | "saude_enfermagem"
  | "saude_farmacia_analises";

export type CurriculumDisciplineBlueprint = {
  nome: string;
  classe: string;
  tipo?: "core" | "eletivo" | "especifica";
  nivel?: "base" | "secundario1" | "secundario2" | "tecnico";
  curso?: string;
};

const d = (
  nome: string,
  classe: string,
  extra?: Partial<CurriculumDisciplineBlueprint>
): CurriculumDisciplineBlueprint => ({ nome, classe, ...extra });

const grid = (
  classes: readonly string[],
  nomes: readonly string[],
  extra?: Partial<CurriculumDisciplineBlueprint>
) => classes.flatMap((classe) => nomes.map((nome) => d(nome, classe, extra)));

const SOCIOCULTURAL = [
  DISC.PT,
  DISC.ING,
  DISC.EF,
  "Informática",
  "Empreendedorismo",
  "Formação de Atitude Integrada",
] as const;

const SAUDE_BASE = [
  DISC.MAT,
  DISC.BIO,
  DISC.QUI,
  DISC.FIS,
  "Psicologia Geral",
  "Ética",
] as const;

const INDUSTRIAL_BASE = [
  DISC.MAT,
  DISC.FIS,
  DISC.QUI,
  "Desenho Técnico",
  DISC.DGD,
] as const;

export const CURRICULUM_PRESETS: Record<
  CurriculumKey,
  CurriculumDisciplineBlueprint[]
> = {
  primario_base: [
    ...grid(
      [CLASSES.C1, CLASSES.C2, CLASSES.C3, CLASSES.C4],
      [DISC.PT, DISC.MAT, DISC.EST_MEIO, DISC.EF, DISC.EMC]
    ),
    ...grid(
      [CLASSES.C5, CLASSES.C6],
      [DISC.PT, DISC.MAT, DISC.CN, DISC.HGA, DISC.EF, DISC.EMC]
    ),
  ],

  primario_avancado: [
    ...grid(
      [CLASSES.C1, CLASSES.C2, CLASSES.C3, CLASSES.C4],
      [DISC.PT, DISC.MAT, DISC.EST_MEIO, DISC.ING, DISC.EF, DISC.EMC]
    ),
    ...grid(
      [CLASSES.C5, CLASSES.C6],
      [DISC.PT, DISC.MAT, DISC.CN, DISC.HGA, DISC.ING, DISC.EF, DISC.EMC]
    ),
  ],

  ciclo1: grid(
    [CLASSES.C7, CLASSES.C8, CLASSES.C9],
    [
      DISC.PT,
      DISC.ING,
      DISC.MAT,
      DISC.FIS,
      DISC.QUI,
      DISC.BIO,
      DISC.HIST,
      DISC.GEO,
      DISC.EF,
    ]
  ),

  puniv: [
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12],
      [DISC.PT, DISC.MAT, DISC.FIS, DISC.QUI, DISC.BIO, DISC.EF]
    ),
    ...grid([CLASSES.C10, CLASSES.C11], [DISC.DGD]),
  ],

  economicas: [
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12],
      [DISC.PT, DISC.MAT, DISC.ECON, DISC.CONT_G, DISC.EF]
    ),
    d(DISC.DIR_INTRO, CLASSES.C10),
    d(DISC.GEO_ECO, CLASSES.C10),
    d("Direito das Obrigações", CLASSES.C11),
    d(DISC.GEO_ECO, CLASSES.C11),
    d("Direito Comercial", CLASSES.C12),
  ],

  tecnico_informatica: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [DISC.PT]),
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12], [DISC.MAT]),
    d("Introdução à Informática", CLASSES.C10, { tipo: "especifica" }),
    d("Lógica de Programação", CLASSES.C10, { tipo: "especifica" }),
    d("Arquitetura de Computadores", CLASSES.C10, { tipo: "especifica" }),
    d("Redes de Computadores", CLASSES.C11, { tipo: "especifica" }),
    d("Sistemas Operativos", CLASSES.C11, { tipo: "especifica" }),
    d("Programação Orientada a Objetos", CLASSES.C11, { tipo: "especifica" }),
    d("Bases de Dados", CLASSES.C12, { tipo: "especifica" }),
    d("Programação Web", CLASSES.C12, { tipo: "especifica" }),
    d("Sistemas de Informação", CLASSES.C12, { tipo: "especifica" }),
    d("Segurança Informática", CLASSES.C13, { tipo: "especifica" }),
    d("Gestão de Projectos TI", CLASSES.C13, { tipo: "especifica" }),
    d("Projecto Tecnológico", CLASSES.C13, { tipo: "especifica" }),
  ],

  tecnico_gestao: [
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13],
      [...SOCIOCULTURAL, DISC.MAT]
    ),
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13],
      [DISC.CONT_G, "Fiscalidade", "Matemática Financeira", DISC.ECON]
    ),
  ],

  tecnico_construcao: [
    ...grid(
      [CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13],
      [DISC.PT, DISC.EF, ...INDUSTRIAL_BASE]
    ),
    // Específicas
    d(DISC.DESENHO_TEC, CLASSES.C10, { tipo: "especifica" }),
    d(DISC.MAT_CONST, CLASSES.C10, { tipo: "especifica" }),
    d(DISC.TOPOGRAFIA, CLASSES.C10, { tipo: "especifica" }),
    d(DISC.RES_MAT, CLASSES.C11, { tipo: "especifica" }),
    d(DISC.TEC_CONST, CLASSES.C11, { tipo: "especifica" }),
    d(DISC.INST_PRED, CLASSES.C11, { tipo: "especifica" }),
    d(DISC.ESTRUTURAS, CLASSES.C12, { tipo: "especifica" }),
    d(DISC.GEST_OBRAS, CLASSES.C12, { tipo: "especifica" }),
    d(DISC.ORC_CUSTOS, CLASSES.C12, { tipo: "especifica" }),
    d(DISC.SEG_HIG, CLASSES.C13, { tipo: "especifica" }),
    d(DISC.LEG_CONST, CLASSES.C13, { tipo: "especifica" }),
    d(DISC.PROJ_CONST, CLASSES.C13, { tipo: "especifica" }),
  ],

  tecnico_base: grid(
    [CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13],
    [DISC.PT, DISC.MAT, "Informática", DISC.EF, "Empreendedorismo"]
  ),

  saude_enfermagem: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [
      ...SOCIOCULTURAL,
      ...SAUDE_BASE,
    ]),
    ...grid([CLASSES.C11, CLASSES.C12, CLASSES.C13], [
      "Anatomia",
      "Fundamentos de Enfermagem",
      "Saúde Comunitária",
    ]),
    ...grid([CLASSES.C12, CLASSES.C13], ["Farmacologia"]),
  ],

  saude_farmacia_analises: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [
      ...SOCIOCULTURAL,
      ...SAUDE_BASE,
    ]),
    ...grid([CLASSES.C11, CLASSES.C12, CLASSES.C13], [
      "Tecnologia Farmacêutica",
      "Química Farmacêutica",
      "Bioquímica Clínica",
    ]),
    ...grid([CLASSES.C12, CLASSES.C13], ["Microbiologia", "Imunologia"]),
  ],
};

export type CurriculumPresetMeta = {
  key: CurriculumKey;
  label: string;
  description?: string;
  badge?: string;
  recommended?: boolean;
  classes: string[];
  subjectsCount: number;
};

const META_INFO: Record<
  CurriculumKey,
  Omit<CurriculumPresetMeta, "classes" | "subjectsCount">
> = {
  primario_base: {
    key: "primario_base",
    label: "Primário (Base)",
    badge: "1ª-6ª",
    description: "Núcleo essencial para o 1º ciclo",
    recommended: true,
  },
  primario_avancado: {
    key: "primario_avancado",
    label: "Primário (Avançado)",
    badge: "1ª-6ª",
    description: "Inclui Inglês e reforço de ciências",
  },
  ciclo1: {
    key: "ciclo1",
    label: "1º Ciclo",
    badge: "7ª-9ª",
    description: "Transição para o ensino secundário",
  },
  puniv: {
    key: "puniv",
    label: "Ciências Físico-Biológicas",
    badge: "IIº Ciclo",
    description: "Preparação para áreas científicas",
    recommended: true,
  },
  economicas: {
    key: "economicas",
    label: "Ciências Económicas e Jurídicas",
    badge: "IIº Ciclo",
    description: "Base para Gestão, Economia e Direito",
  },
  tecnico_informatica: {
    key: "tecnico_informatica",
    label: "Técnico de Informática",
    badge: "Técnico",
    description: "Programação, redes e projecto",
    recommended: true,
  },
  tecnico_gestao: {
    key: "tecnico_gestao",
    label: "Técnico de Gestão / Contabilidade",
    badge: "Técnico",
    description: "Fiscalidade, contabilidade e finanças",
  },
  tecnico_construcao: {
    key: "tecnico_construcao",
    label: "Técnico de Construção Civil",
    badge: "Técnico",
    description: "Desenho, materiais e topografia",
  },
  tecnico_base: {
    key: "tecnico_base",
    label: "Técnico (Base Genérica)",
    badge: "Técnico",
    description: "Modelo para cursos técnicos não listados",
  },
  saude_enfermagem: {
    key: "saude_enfermagem",
    label: "Técnico de Enfermagem",
    badge: "Saúde",
    description: "Fundamentos, comunidade e cuidados clínicos",
  },
  saude_farmacia_analises: {
    key: "saude_farmacia_analises",
    label: "Farmácia / Análises Clínicas",
    badge: "Saúde",
    description: "Tecnologia farmacêutica e laboratório",
  },
};

const uniqueClasses = (key: CurriculumKey) =>
  Array.from(new Set(CURRICULUM_PRESETS[key]?.map((d) => d.classe) || []));

const uniqueSubjectCount = (key: CurriculumKey) =>
  new Set(CURRICULUM_PRESETS[key]?.map((d) => d.nome) || []).size;

export const CURRICULUM_PRESETS_META: Record<CurriculumKey, CurriculumPresetMeta> =
  Object.fromEntries(
    (Object.keys(META_INFO) as CurriculumKey[]).map((key) => [
      key,
      {
        ...META_INFO[key],
        classes: uniqueClasses(key),
        subjectsCount: uniqueSubjectCount(key),
      },
    ])
  ) as Record<CurriculumKey, CurriculumPresetMeta>;

export const getPresetMeta = (key: CurriculumKey): CurriculumPresetMeta => {
  return CURRICULUM_PRESETS_META[key];
};

export const getAllPresetsMeta = (): CurriculumPresetMeta[] =>
  Object.values(CURRICULUM_PRESETS_META);

export const getSubjectsCount = (key: CurriculumKey): number =>
  CURRICULUM_PRESETS_META[key]?.subjectsCount ?? 0;
