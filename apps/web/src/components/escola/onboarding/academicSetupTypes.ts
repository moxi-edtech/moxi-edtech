import { CurriculumKey, CurriculumCategory, CurriculumDisciplineBlueprint } from "@/lib/onboarding";

// =========================
// TIPOS PRINCIPAIS
// =========================

export type TurnosState = {
  Manhã: boolean;
  Tarde: boolean;
  Noite: boolean;
};

export type AcademicSession = {
  id: string;
  nome: string | null;
  ano_letivo?: number;
  status: "ativa" | "inativa";
  data_inicio?: string | null;
  data_fim?: string | null;
};

export type Periodo = {
  id: string;
  nome: string;
  numero: number;
  data_inicio: string | null;
  data_fim: string | null;
};

export type MatrixRow = {
  // Alterado para string | number para flexibilidade, mas usaremos string no novo componente
  id: string | number; 
  nome: string;
  cursoKey?: string; // Novo campo para saber a origem
  manha: number;
  tarde: number;
  noite: number;
};

export type SelectedBlueprint = {
  key: CurriculumKey;
  label: string;
  disciplinas: string[];
};

export type CurriculumPresetMeta = {
  key: CurriculumKey;
  categoria: CurriculumCategory;
  label: string;
  badge?: string;
};

// =========================
// PROPS DOS COMPONENTES
// =========================

export interface AcademicStep1Props {
  schoolDisplayName: string;
  setSchoolDisplayName: (name: string) => void;
  regime: "trimestral" | "semestral" | "bimestral";
  setRegime: (regime: "trimestral" | "semestral" | "bimestral") => void;
  anoLetivo: string;
  setAnoLetivo: (ano: string) => void;
  turnos: TurnosState;
  onTurnoToggle: (turno: keyof TurnosState) => void;
  sessaoAtiva: AcademicSession | null;
  periodos: Periodo[];
  creatingSession: boolean;
  onCreateSession: () => void;
}

export interface AcademicStep2Props {
  presetCategory: CurriculumCategory;
  onPresetCategoryChange: (category: CurriculumCategory) => void;
  
  // Props simplificadas para a nova lógica
  matrix: MatrixRow[];
  onMatrixChange: (matrix: MatrixRow[]) => void;
  onMatrixUpdate: (id: string | number, field: "manha" | "tarde" | "noite", value: string) => void;
  
  turnos: TurnosState;
  onApplyCurriculumPreset: () => void;
  applyingPreset: boolean;
  
  // Mantidos para compatibilidade se necessário, mas não usados na lógica nova
  curriculumPreset?: CurriculumKey | null;
  onCurriculumPresetChange?: (preset: CurriculumKey | null) => void;
  selectedBlueprint?: SelectedBlueprint | null;
  onSelectedBlueprintChange?: (blueprint: SelectedBlueprint | null) => void;
  presetApplied?: boolean;
}

// =========================
// CONSTANTES E PRESETS
// =========================

export const PRESETS_META: CurriculumPresetMeta[] = [
  // ENSINO GERAL
  {
    key: "primario_base",
    categoria: "geral",
    label: "Primário (Base)",
    badge: "1ª a 6ª Classe",
  },
  {
    key: "ciclo1",
    categoria: "geral",
    label: "1º Ciclo (7ª–9ª)",
  },
  {
    key: "puniv",
    categoria: "geral",
    label: "Ciências Físico-Biológicas",
  },
  {
    key: "economicas",
    categoria: "geral",
    label: "Ciências Económicas e Jurídicas",
  },
  {
    key: "humanas",
    categoria: "geral",
    label: "Ciências Humanas",
  },

  // TÉCNICO – INDÚSTRIA & TEC
  {
    key: "tecnico_informatica",
    categoria: "tecnico_ind",
    label: "Técnico de Informática",
  },
  {
    key: "tecnico_construcao",
    categoria: "tecnico_ind",
    label: "Técnico de Construção Civil",
  },
  {
    key: "tecnico_energia",
    categoria: "tecnico_ind",
    label: "Energia e Instalações",
  },

  // TÉCNICO – GESTÃO & SERVIÇOS
  {
    key: "tecnico_gestao",
    categoria: "tecnico_serv",
    label: "Técnico de Gestão",
  },
  {
    key: "tecnico_rh",
    categoria: "tecnico_serv",
    label: "Recursos Humanos",
  },

  // SAÚDE
  {
    key: "saude_enfermagem",
    categoria: "saude",
    label: "Técnico de Enfermagem",
  },
  {
    key: "saude_farmacia_analises",
    categoria: "saude",
    label: "Farmácia / Análises",
  },
  
  // MAGISTÉRIO
  {
    key: "magisterio_primario",
    categoria: "magisterio",
    label: "Magistério Primário",
  },
];

// =========================
// UTILITÁRIOS
// =========================

// Atualizado para retornar estrutura plana compatível com o blueprint atual
export function createMatrixFromBlueprint(blueprint: any): MatrixRow[] {
  // Se o blueprint for a estrutura antiga (array de objetos com classe), extrai classes únicas
  // Se for a nova (objeto com .classes array), usa direto
  
  let classes: string[] = [];
  
  if (Array.isArray(blueprint)) {
     classes = Array.from(new Set(blueprint.map((d: any) => d.classe)));
  } else if (blueprint?.classes) {
     classes = blueprint.classes;
  }

  return classes.map((cls, idx) => ({
    id: idx, // Será sobrescrito no componente
    nome: cls.includes('ª') ? `${cls} Classe` : cls,
    manha: 0,
    tarde: 0,
    noite: 0,
  }));
}

export function calculateTotalTurmas(matrix: MatrixRow[], turnos: TurnosState): number {
  return matrix.reduce((acc, r) => {
    let sum = 0;
    if (turnos["Manhã"]) sum += r.manha || 0;
    if (turnos["Tarde"]) sum += r.tarde || 0;
    if (turnos["Noite"]) sum += r.noite || 0;
    return acc + sum;
  }, 0);
}