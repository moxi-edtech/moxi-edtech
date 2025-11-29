export type CurriculumCategory =
  | "geral"
  | "tecnico_ind"
  | "tecnico_serv"
  | "saude"
  | "magisterio";

export type CurriculumBlueprint = {
  key: string;
  cat: CurriculumCategory;
  label: string;
  classes: string[]; // "10ª", "11ª"…
  subjects: string[];
};

const TECNICO_SOCIOCULTURAL = [
  "Língua Portuguesa",
  "Língua Estrangeira",
  "Educação Física",
  "Informática",
  "Empreendedorismo",
  "FAI",
];

const TECNICO_INDUSTRIAL = [
  "Matemática",
  "Física",
  "Química",
  "Desenho Técnico",
  "Geometria Descritiva",
];

const TECNICO_SAUDE_BASE = [
  "Matemática",
  "Biologia",
  "Química",
  "Física",
  "Psicologia Geral",
  "Ética",
];

export const CURRICULUM_PRESETS: Record<string, CurriculumBlueprint> = {
  primario: {
    key: "primario",
    cat: "geral",
    label: "Ensino Primário",
    classes: ["1ª", "2ª", "3ª", "4ª", "5ª", "6ª"],
    subjects: [
      "Português",
      "Matemática",
      "Estudo do Meio",
      "Educação Musical",
      "Educação Física",
    ],
  },
  ciclo1: {
    key: "ciclo1",
    cat: "geral",
    label: "Iº Ciclo (7ª-9ª)",
    classes: ["7ª", "8ª", "9ª"],
    subjects: [
      "Português",
      "Inglês",
      "Matemática",
      "Física",
      "Química",
      "Biologia",
      "Geografia",
      "História",
    ],
  },
  puniv_fis: {
    key: "puniv_fis",
    cat: "geral",
    label: "PUNIV (Físicas e Biológicas)",
    classes: ["10ª", "11ª", "12ª"],
    subjects: ["Matemática", "Física", "Química", "Biologia", "Geologia"],
  },
  puniv_hum: {
    key: "puniv_hum",
    cat: "geral",
    label: "PUNIV (Ciências Humanas)",
    classes: ["10ª", "11ª", "12ª"],
    subjects: ["História", "Literatura", "Filosofia", "Psicologia", "Sociologia"],
  },
  tec_info: {
    key: "tec_info",
    cat: "tecnico_ind",
    label: "Técnico de Informática",
    classes: ["10ª", "11ª", "12ª", "13ª"],
    subjects: [
      ...TECNICO_SOCIOCULTURAL,
      "T.L.P",
      "T.R.E.I",
      "S.E.A.C",
      "Projecto Tecnológico",
    ],
  },
  tec_const: {
    key: "tec_const",
    cat: "tecnico_ind",
    label: "Construção Civil",
    classes: ["10ª", "11ª", "12ª", "13ª"],
    subjects: [
      ...TECNICO_SOCIOCULTURAL,
      ...TECNICO_INDUSTRIAL,
      "Desenho de Construção",
      "Materiais",
      "Topografia",
    ],
  },
  tec_energia: {
    key: "tec_energia",
    cat: "tecnico_ind",
    label: "Energia e Instalações",
    classes: ["10ª", "11ª", "12ª", "13ª"],
    subjects: [
      ...TECNICO_SOCIOCULTURAL,
      ...TECNICO_INDUSTRIAL,
      "Electrotecnia",
      "Máquinas Eléctricas",
      "Práticas Oficinais",
    ],
  },
  tec_gest: {
    key: "tec_gest",
    cat: "tecnico_serv",
    label: "Técnico de Gestão",
    classes: ["10ª", "11ª", "12ª", "13ª"],
    subjects: [
      ...TECNICO_SOCIOCULTURAL,
      "Contabilidade Geral",
      "Fiscalidade",
      "Matemática Financeira",
      "Economia",
    ],
  },
  tec_rh: {
    key: "tec_rh",
    cat: "tecnico_serv",
    label: "Recursos Humanos",
    classes: ["10ª", "11ª", "12ª", "13ª"],
    subjects: [
      ...TECNICO_SOCIOCULTURAL,
      "Gestão de RH",
      "Direito do Trabalho",
      "Psicologia do Trabalho",
      "Técnicas Administrativas",
    ],
  },
  saude_enf: {
    key: "saude_enf",
    cat: "saude",
    label: "Enfermagem",
    classes: ["10ª", "11ª", "12ª", "13ª"],
    subjects: [
      ...TECNICO_SOCIOCULTURAL,
      ...TECNICO_SAUDE_BASE,
      "Anatomia",
      "Fundamentos de Enfermagem",
      "Saúde Comunitária",
      "Farmacologia",
    ],
  },
  saude_farmacia: {
    key: "saude_farmacia",
    cat: "saude",
    label: "Farmácia",
    classes: ["10ª", "11ª", "12ª", "13ª"],
    subjects: [
      ...TECNICO_SOCIOCULTURAL,
      ...TECNICO_SAUDE_BASE,
      "Tecnologia Farmacêutica",
      "Farmacognosia",
      "Química Farmacêutica",
    ],
  },
  magisterio_pri: {
    key: "magisterio_pri",
    cat: "magisterio",
    label: "Magistério Primário",
    classes: ["10ª", "11ª", "12ª", "13ª"],
    subjects: [
      ...TECNICO_SOCIOCULTURAL,
      "Pedagogia",
      "Psicologia do Desenvolvimento",
      "Didática de Português",
      "Didática de Matemática",
      "Práticas Pedagógicas",
    ],
  },
};
