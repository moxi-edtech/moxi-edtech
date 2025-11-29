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
  id: number;
  nome: string;
  manha?: number;
  tarde?: number;
  noite?: number;
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
  curriculumPreset: CurriculumKey | null;
  onCurriculumPresetChange: (preset: CurriculumKey | null) => void;
  selectedBlueprint: SelectedBlueprint | null;
  onSelectedBlueprintChange: (blueprint: SelectedBlueprint | null) => void;
  matrix: MatrixRow[];
  onMatrixChange: (matrix: MatrixRow[]) => void;
  onMatrixUpdate: (id: number, field: "manha" | "tarde" | "noite", value: string) => void;
  presetApplied: boolean;
  applyingPreset: boolean;
  turnos: TurnosState;
  onApplyCurriculumPreset: () => void;
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
    key: "primario_avancado",
    categoria: "geral",
    label: "Primário (Avançado)",
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
    key: "tecnico_base",
    categoria: "tecnico_ind",
    label: "Técnico (Base Genérica)",
  },

  // TÉCNICO – GESTÃO & SERVIÇOS
  {
    key: "tecnico_gestao",
    categoria: "tecnico_serv",
    label: "Técnico de Gestão / Contabilidade",
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
    label: "Farmácia / Análises Clínicas",
  },
];

// =========================
// UTILITÁRIOS
// =========================

export function createMatrixFromBlueprint(blueprint: CurriculumDisciplineBlueprint[]): MatrixRow[] {
  const uniqueClasses = Array.from(
    new Set(blueprint.map((d: CurriculumDisciplineBlueprint) => d.classe))
  );

  return uniqueClasses.map((cls, idx) => ({
    id: idx,
    nome: cls,
    manha: 0,
    tarde: 0,
    noite: 0,
  }));
}

export function getDisciplinasFromBlueprint(blueprint: CurriculumDisciplineBlueprint[]): string[] {
  return Array.from(new Set(blueprint.map((d) => d.nome)));
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