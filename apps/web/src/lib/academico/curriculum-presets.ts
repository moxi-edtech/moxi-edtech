const DISC = {
  PT: "Língua Portuguesa",
  ING: "Língua Estrangeira",
  FR: "Língua Francesa", // Adicionado
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
  FIL: "Filosofia", // Adicionado
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
  SEG_HIG: "Segurança e Higiene no Trabalho",
  LEG_CONST: "Legislação da Construção",
  PROJ_CONST: "Projecto de Construção",
  EMP: "Empreendedorismo",
  INF: "Informática",
  FAI: "Formação de Atitude Integrada",
  OGI: "Org. e Gestão Industrial",
} as const;

const CLASSES = {
  C1: "1ª Classe", C2: "2ª Classe", C3: "3ª Classe", C4: "4ª Classe",
  C5: "5ª Classe", C6: "6ª Classe",
  C7: "7ª Classe", C8: "8ª Classe", C9: "9ª Classe",
  C10: "10ª Classe", C11: "11ª Classe", C12: "12ª Classe", C13: "13ª Classe",
} as const;

export type CurriculumKey =
  | "primario_base"
  | "primario_avancado"
  | "ciclo1"
  | "puniv_fisicas"
  | "puniv_economicas"
  | "puniv_humanas" // Novo
  | "puniv_artes" // Novo
  | "tecnico_informatica"
  | "tecnico_gestao"
  | "tecnico_construcao"
  | "tecnico_electricidade" // Novo
  | "tecnico_mecanica" // Novo
  | "tecnico_electronica" // Novo
  | "tecnico_petroleos" // Novo (Ouro Negro)
  | "tecnico_base"
  | "saude_enfermagem"
  | "saude_farmacia_analises"
  | "magisterio_primario"; // Novo

export type CurriculumDisciplineBlueprint = {
  nome: string;
  classe: string;
  tipo?: "core" | "eletivo" | "especifica";
  nivel?: "base" | "secundario1" | "secundario2" | "tecnico";
  curso?: string;
};

const d = (nome: string, classe: string, extra?: Partial<CurriculumDisciplineBlueprint>): CurriculumDisciplineBlueprint => ({ nome, classe, ...extra });

const grid = (classes: readonly string[], nomes: readonly string[], extra?: Partial<CurriculumDisciplineBlueprint>) => 
  classes.flatMap((classe) => nomes.map((nome) => d(nome, classe, extra)));

// --- BASES COMUNS ---

const SOCIOCULTURAL = [
  DISC.PT, DISC.ING, DISC.EF, DISC.INF, DISC.EMP, DISC.FAI
] as const;

const PUNIV_BASE = [
  DISC.PT, DISC.ING, DISC.FIL, DISC.MAT, DISC.EF
] as const;

const TECNICO_INDUSTRIAL_BASE = [
  DISC.PT, DISC.ING, DISC.MAT, DISC.FIS, DISC.QUI, DISC.EF, DISC.INF, DISC.EMP, DISC.DESENHO_TEC
] as const;

const SAUDE_BASE = [
  DISC.MAT, DISC.BIO, DISC.QUI, DISC.FIS, "Psicologia Geral", "Ética e Deontologia"
] as const;

export const CURRICULUM_PRESETS: Record<CurriculumKey, CurriculumDisciplineBlueprint[]> = {
  
  // ==========================================
  // ENSINO GERAL (PRIMÁRIO E Iº CICLO)
  // ==========================================
  primario_base: [
    ...grid([CLASSES.C1, CLASSES.C2, CLASSES.C3, CLASSES.C4], [DISC.PT, DISC.MAT, DISC.EST_MEIO, DISC.EF, DISC.EMC]),
    ...grid([CLASSES.C5, CLASSES.C6], [DISC.PT, DISC.MAT, DISC.CN, DISC.HGA, DISC.EF, DISC.EMC]),
  ],

  primario_avancado: [
    ...grid([CLASSES.C1, CLASSES.C2, CLASSES.C3, CLASSES.C4], [DISC.PT, DISC.MAT, DISC.EST_MEIO, DISC.ING, DISC.EF, DISC.EMC]),
    ...grid([CLASSES.C5, CLASSES.C6], [DISC.PT, DISC.MAT, DISC.CN, DISC.HGA, DISC.ING, DISC.EF, DISC.EMC]),
  ],

  ciclo1: grid([CLASSES.C7, CLASSES.C8, CLASSES.C9], [
    DISC.PT, DISC.ING, DISC.MAT, DISC.FIS, DISC.QUI, DISC.BIO, DISC.HIST, DISC.GEO, DISC.EF, DISC.EMC, "Educação Visual e Plástica", "Educação Laboral"
  ]),

  // ==========================================
  // ENSINO SECUNDÁRIO GERAL (PUNIV / LICEU)
  // ==========================================
  puniv_fisicas: [ // CFB
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12], [...PUNIV_BASE, DISC.FIS, DISC.QUI, DISC.BIO]),
    ...grid([CLASSES.C10, CLASSES.C11], [DISC.DGD, "Informática"]),
    d("Geologia", CLASSES.C12),
  ],

  puniv_economicas: [ // CEJ
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12], [...PUNIV_BASE, DISC.ECON, DISC.CONT_G, DISC.HIST]),
    d(DISC.DIR_INTRO, CLASSES.C10),
    d(DISC.GEO_ECO, CLASSES.C10),
    d(DISC.GEO_ECO, CLASSES.C11),
    d("Direito", CLASSES.C11),
    d("Direito", CLASSES.C12),
    d("Sociologia", CLASSES.C12),
  ],

  puniv_humanas: [ // CCH - Ciências Humanas
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12], [
      DISC.PT, DISC.ING, DISC.FR, DISC.HIST, DISC.GEO, DISC.FIL, DISC.EF, DISC.MAT
    ]),
    d("Literatura em Língua Portuguesa", CLASSES.C10),
    d("Literatura Angolana", CLASSES.C11),
    d("Psicologia", CLASSES.C12),
    d("Antropologia", CLASSES.C12),
  ],

  puniv_artes: [ // AV - Artes Visuais
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12], [
      DISC.PT, DISC.ING, DISC.FIL, DISC.MAT, DISC.EF, "História da Arte", "Desenho"
    ]),
    ...grid([CLASSES.C10, CLASSES.C11], [DISC.DGD, "Geometria Descritiva"]),
    d("Oficina de Artes", CLASSES.C12),
    d("Design", CLASSES.C12),
  ],

  // ==========================================
  // TÉCNICO PROFISSIONAL (INSTITUTOS)
  // ==========================================
  tecnico_informatica: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [DISC.PT, DISC.ING, DISC.MAT, DISC.FIS, DISC.EF, DISC.EMP]),
    d("Introdução à Informática", CLASSES.C10, { tipo: "especifica" }),
    d("Técnicas e Linguagens de Programação", CLASSES.C10, { tipo: "especifica" }), // TLP
    d("Sistemas Digitais", CLASSES.C10, { tipo: "especifica" }),
    d("Arquitetura de Computadores", CLASSES.C11, { tipo: "especifica" }),
    d("Técnicas e Linguagens de Programação", CLASSES.C11, { tipo: "especifica" }),
    d("Sistemas Operativos", CLASSES.C11, { tipo: "especifica" }),
    d("Bases de Dados", CLASSES.C12, { tipo: "especifica" }),
    d("Redes de Computadores", CLASSES.C12, { tipo: "especifica" }),
    d("Projecto Tecnológico", CLASSES.C12, { tipo: "especifica" }),
    d("Teleprocessamento", CLASSES.C13, { tipo: "especifica" }),
    d("Instalação e Manutenção", CLASSES.C13, { tipo: "especifica" }),
    d("Projecto Tecnológico", CLASSES.C13, { tipo: "especifica" }),
  ],

  tecnico_gestao: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [...SOCIOCULTURAL, DISC.MAT]),
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [DISC.CONT_G, "Fiscalidade", "Matemática Financeira", DISC.ECON, "Estatística"]),
    d("Práticas de Contabilidade", CLASSES.C12),
    d("Auditoria", CLASSES.C13),
  ],

  tecnico_construcao: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [...TECNICO_INDUSTRIAL_BASE]),
    d(DISC.MAT_CONST, CLASSES.C10, { tipo: "especifica" }),
    d(DISC.TOPOGRAFIA, CLASSES.C10, { tipo: "especifica" }),
    d(DISC.RES_MAT, CLASSES.C11, { tipo: "especifica" }),
    d("Tecnologia e Org. de Obras", CLASSES.C11, { tipo: "especifica" }),
    d(DISC.ESTRUTURAS, CLASSES.C12, { tipo: "especifica" }),
    d("Hidráulica", CLASSES.C12, { tipo: "especifica" }),
    d("Medições e Orçamentos", CLASSES.C12, { tipo: "especifica" }),
    d(DISC.PROJ_CONST, CLASSES.C13, { tipo: "especifica" }),
  ],

  tecnico_electricidade: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [...TECNICO_INDUSTRIAL_BASE]),
    d("Electrotecnia", CLASSES.C10, { tipo: "especifica" }),
    d("Tecnologia Eléctrica", CLASSES.C10, { tipo: "especifica" }),
    d("Práticas Oficinais", CLASSES.C10, { tipo: "especifica" }),
    d("Máquinas Eléctricas", CLASSES.C11, { tipo: "especifica" }),
    d("Instalações Eléctricas", CLASSES.C11, { tipo: "especifica" }),
    d("Electrónica Industrial", CLASSES.C12, { tipo: "especifica" }),
    d("Automatismos", CLASSES.C12, { tipo: "especifica" }),
    d("Projecto Tecnológico", CLASSES.C13, { tipo: "especifica" }),
  ],

  tecnico_electronica: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [...TECNICO_INDUSTRIAL_BASE]),
    d("Electricidade e Electromagnetismo", CLASSES.C10, { tipo: "especifica" }),
    d("Tecnologia Electrónica", CLASSES.C10, { tipo: "especifica" }),
    d("Sistemas Digitais", CLASSES.C11, { tipo: "especifica" }),
    d("Telecomunicações", CLASSES.C11, { tipo: "especifica" }),
    d("Televisão e Vídeo", CLASSES.C12, { tipo: "especifica" }),
    d("Automação e Robótica", CLASSES.C12, { tipo: "especifica" }),
    d("Projecto de Telecomunicações", CLASSES.C13, { tipo: "especifica" }),
  ],

  tecnico_mecanica: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [...TECNICO_INDUSTRIAL_BASE]),
    d("Tecnologia Mecânica", CLASSES.C10, { tipo: "especifica" }),
    d("Sistemas Mecânicos", CLASSES.C10, { tipo: "especifica" }),
    d("Org. e Gestão Industrial", CLASSES.C11, { tipo: "especifica" }),
    d("Máquinas Térmicas", CLASSES.C11, { tipo: "especifica" }),
    d("Hidráulica e Pneumática", CLASSES.C12, { tipo: "especifica" }),
    d("Manutenção Mecânica", CLASSES.C12, { tipo: "especifica" }),
    d("Projecto Mecânico", CLASSES.C13, { tipo: "especifica" }),
  ],

  tecnico_petroleos: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [...TECNICO_INDUSTRIAL_BASE]),
    d("Geologia Geral", CLASSES.C10, { tipo: "especifica" }),
    d("Química Orgânica", CLASSES.C10, { tipo: "especifica" }),
    d("Geologia de Petróleos", CLASSES.C11, { tipo: "especifica" }),
    d("Fluidos de Perfuração", CLASSES.C11, { tipo: "especifica" }),
    d("Perfuração", CLASSES.C12, { tipo: "especifica" }),
    d("Produção Petrolífera", CLASSES.C12, { tipo: "especifica" }),
    d("Refinação", CLASSES.C13, { tipo: "especifica" }),
    d("Instrumentação Petrolífera", CLASSES.C13, { tipo: "especifica" }),
  ],

  tecnico_base: grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [
    DISC.PT, DISC.MAT, DISC.INF, DISC.EF, DISC.EMP, DISC.FAI, DISC.DESENHO_TEC
  ]),

  // ==========================================
  // SAÚDE
  // ==========================================
  saude_enfermagem: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [...SOCIOCULTURAL, ...SAUDE_BASE]),
    ...grid([CLASSES.C11, CLASSES.C12, CLASSES.C13], ["Anatomia", "Fisiologia", "Fundamentos de Enfermagem", "Saúde Comunitária"]),
    ...grid([CLASSES.C12, CLASSES.C13], ["Farmacologia", "Patologia", "Pediatria", "Ginecologia e Obstetrícia"]),
    d("Estágio Supervisionado", CLASSES.C13, { tipo: "especifica" }),
  ],

  saude_farmacia_analises: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [...SOCIOCULTURAL, ...SAUDE_BASE]),
    d("Biologia Celular", CLASSES.C10),
    d("Química Inorgânica", CLASSES.C10),
    d("Tecnologia Farmacêutica", CLASSES.C11),
    d("Bioquímica Clínica", CLASSES.C11),
    d("Microbiologia", CLASSES.C12),
    d("Imunologia", CLASSES.C12),
    d("Parasitologia", CLASSES.C12),
    d("Controlo de Qualidade", CLASSES.C13),
  ],

  // ==========================================
  // FORMAÇÃO DE PROFESSORES
  // ==========================================
  magisterio_primario: [
    ...grid([CLASSES.C10, CLASSES.C11, CLASSES.C12, CLASSES.C13], [
      DISC.PT, DISC.MAT, DISC.EF, DISC.INF, DISC.EMP, "Psicologia do Desenvolvimento", "Pedagogia Geral"
    ]),
    d("Didática do Português", CLASSES.C11),
    d("Didática da Matemática", CLASSES.C11),
    d("História da Educação", CLASSES.C11),
    d("Sociologia da Educação", CLASSES.C12),
    d("Práticas Pedagógicas", CLASSES.C12),
    d("Estágio Pedagógico", CLASSES.C13, { tipo: "especifica" }),
  ],
};

// ==========================================
// METADADOS E SIGLAS OFICIAIS
// ==========================================

export type CurriculumPresetMeta = {
  key: CurriculumKey;
  label: string;
  course_code: string; // A SIGLA QUE O IMPORTADOR VAI USAR (Ex: TI, TG, CFB)
  description?: string;
  badge?: string;
  recommended?: boolean;
  classes: string[];
  subjectsCount: number;
};

const META_INFO: Record<CurriculumKey, Omit<CurriculumPresetMeta, "classes" | "subjectsCount">> = {
  // GERAL
  primario_base: { key: "primario_base", label: "Ensino Primário (Base)", course_code: "EP", badge: "1ª-6ª", description: "1ª à 4ª Classe", recommended: true },
  primario_avancado: { key: "primario_avancado", label: "Ensino Primário (Completo)", course_code: "EP", badge: "1ª-6ª", description: "Inclui 5ª e 6ª Classe" },
  ciclo1: { key: "ciclo1", label: "Iº Ciclo do Secundário", course_code: "ESG", badge: "7ª-9ª", description: "Ensino Secundário Geral (7ª-9ª)" },

  // PUNIV
  puniv_fisicas: { key: "puniv_fisicas", label: "Ciências Físicas e Biológicas", course_code: "CFB", badge: "PUNIV", description: "Foco em Saúde e Engenharias", recommended: true },
  puniv_economicas: { key: "puniv_economicas", label: "Ciências Económicas e Jurídicas", course_code: "CEJ", badge: "PUNIV", description: "Direito, Economia e Gestão" },
  puniv_humanas: { key: "puniv_humanas", label: "Ciências Humanas", course_code: "CCH", badge: "PUNIV", description: "História, Línguas e Psicologia" },
  puniv_artes: { key: "puniv_artes", label: "Artes Visuais", course_code: "AV", badge: "PUNIV", description: "Design, Desenho e Artes" },

  // TÉCNICO
  tecnico_informatica: { key: "tecnico_informatica", label: "Técnico de Informática", course_code: "TI", badge: "Técnico", description: "Sistemas, Redes e Programação", recommended: true },
  tecnico_gestao: { key: "tecnico_gestao", label: "Técnico de Gestão", course_code: "TG", badge: "Técnico", description: "Contabilidade e Finanças" },
  tecnico_construcao: { key: "tecnico_construcao", label: "Construção Civil", course_code: "CC", badge: "Técnico", description: "Obras e Projetos" },
  tecnico_electricidade: { key: "tecnico_electricidade", label: "Energia e Instalações Eléctricas", course_code: "EL", badge: "Técnico", description: "Eletricidade Industrial" },
  tecnico_mecanica: { key: "tecnico_mecanica", label: "Mecânica de Manutenção", course_code: "MEC", badge: "Técnico", description: "Máquinas e Motores" },
  tecnico_electronica: { key: "tecnico_electronica", label: "Electrónica e Telecomunicações", course_code: "ET", badge: "Técnico", description: "Telecom e Robótica" },
  tecnico_petroleos: { key: "tecnico_petroleos", label: "Geologia e Petróleos", course_code: "PET", badge: "Técnico", description: "Perfuração e Produção" },
  
  tecnico_base: { key: "tecnico_base", label: "Técnico (Genérico)", course_code: "TEC", badge: "Técnico", description: "Base para outros cursos" },

  // SAÚDE
  saude_enfermagem: { key: "saude_enfermagem", label: "Técnico de Enfermagem", course_code: "ENF", badge: "Saúde", description: "Cuidados de Enfermagem" },
  saude_farmacia_analises: { key: "saude_farmacia_analises", label: "Análises Clínicas", course_code: "AC", badge: "Saúde", description: "Laboratório Clínico" },

  // MAGISTÉRIO
  magisterio_primario: { key: "magisterio_primario", label: "Magistério Primário", course_code: "MP", badge: "Professor", description: "Formação de Professores" },
};

// ... helpers (uniqueClasses, uniqueSubjectCount) mantêm iguais

export const CURRICULUM_PRESETS_META = Object.fromEntries(
  (Object.keys(META_INFO) as CurriculumKey[]).map((key) => [
    key,
    {
      ...META_INFO[key],
      classes: Array.from(new Set(CURRICULUM_PRESETS[key]?.map((d) => d.classe) || [])),
      subjectsCount: new Set(CURRICULUM_PRESETS[key]?.map((d) => d.nome) || []).size,
    },
  ])
) as Record<CurriculumKey, CurriculumPresetMeta>;

export const getPresetMeta = (key: CurriculumKey) => CURRICULUM_PRESETS_META[key];
export const getAllPresetsMeta = () => Object.values(CURRICULUM_PRESETS_META);
export const getSubjectsCount = (key: CurriculumKey) => CURRICULUM_PRESETS_META[key]?.subjectsCount ?? 0;