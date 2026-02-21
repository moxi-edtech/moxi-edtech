// academicSetupTypes.ts (ou lib/onboarding/types.ts)

import type { Dispatch, SetStateAction } from "react";
import type { CurriculumKey, CurriculumDisciplineBlueprint } from "@/lib/onboarding";
import type { CourseType } from "@/lib/courseTypes";
import type {
  AcademicSession as BaseAcademicSession,
  AcademicPeriod as BaseAcademicPeriod,
} from "@/types/academico.types";

export type AcademicSession = BaseAcademicSession;
export type Periodo = BaseAcademicPeriod;
export type PadraoNomenclatura = 'descritivo_completo' | 'descritivo_simples' | 'abreviado';

// Atualizar a interface da matriz para incluir o tipo do curso
export interface MatrixRow {
  id: string;
  nome: string; // Nome da classe (ex: "7ª Classe")
  manha: number;
  tarde: number;
  noite: number;
  cursoKey: CurriculumKey;
  cursoTipo?: CourseType; // NOVO: tipo do curso
  cursoNome?: string; // NOVO: nome do curso
}

export interface TurnosState {
  Manhã: boolean;
  Tarde: boolean;
  Noite: boolean;
}

// Props do Step 1 (Identidade & Sessão)
export interface AcademicStep1Props {
  schoolDisplayName: string;
  setSchoolDisplayName: (val: string) => void;
  anoLetivo: number;
  setAnoLetivo: (val: number) => void;
  dataInicio: string;
  setDataInicio: (val: string) => void;
  dataFim: string;
  setDataFim: (val: string) => void;
  periodosConfig: {
    numero: number;
    data_inicio: string;
    data_fim: string;
    trava_notas_em: string;
  }[];
  onPeriodoChange: (numero: number, field: "data_inicio" | "data_fim" | "trava_notas_em", value: string) => void;
  turnos: TurnosState;
  onTurnoToggle: (turno: keyof TurnosState) => void;
  sessaoAtiva: AcademicSession | null;
  periodos: Periodo[];
  creatingSession: boolean;
  onCreateSession: () => void;
}

export interface AcademicStep2ConfigProps {
  frequenciaModelo: 'POR_AULA' | 'POR_PERIODO';
  onFrequenciaModeloChange: (val: 'POR_AULA' | 'POR_PERIODO') => void;
  frequenciaMinPercent: number;
  onFrequenciaMinPercentChange: (val: number) => void;
  modeloAvaliacao: 'SIMPLIFICADO' | 'ANGOLANO_TRADICIONAL' | 'COMPETENCIAS' | 'DEPOIS';
  onModeloAvaliacaoChange: (val: 'SIMPLIFICADO' | 'ANGOLANO_TRADICIONAL' | 'COMPETENCIAS' | 'DEPOIS') => void;
  avaliacaoConfig: { componentes?: { code: string; peso: number; ativo: boolean }[] };
}

export type CurriculumCategory = "geral" | "tecnico_ind" | "tecnico_serv";

// ATUALIZADA: Criar matriz a partir do blueprint
export function createMatrixFromBlueprint(blueprint: CurriculumDisciplineBlueprint[]): MatrixRow[] {
  // Extrair classes únicas do blueprint
  const classes = Array.from(new Set(blueprint.map(d => d.classe)));
  
  return classes.map(classe => ({
    id: `${classe}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    nome: classe,
    manha: 0,
    tarde: 0,
    noite: 0,
    cursoKey: "" as CurriculumKey, // Será preenchido depois
    cursoTipo: "geral" as CourseType, // Será preenchido depois
  }));
}

// Calcular total de turmas
export function calculateTotalTurmas(matrix: MatrixRow[], turnos: TurnosState): number {
  return matrix.reduce((total, row) => {
    let sum = 0;
    if (turnos.Manhã) sum += row.manha;
    if (turnos.Tarde) sum += row.tarde;
    if (turnos.Noite) sum += row.noite;
    return total + sum;
  }, 0);
}

// Interface para as props do componente
export interface AcademicStep2Props {
  escolaId: string;
  presetCategory: CurriculumCategory;
  onPresetCategoryChange: (category: CurriculumCategory) => void;
  matrix: MatrixRow[];
  onMatrixChange: (matrix: MatrixRow[]) => void;
  onMatrixUpdate: (id: string, field: 'manha' | 'tarde' | 'noite', value: string) => void;
  turnos: TurnosState;
  onApplyCurriculumPreset: () => void;
  applyingPreset: boolean;
  padraoNomenclatura: PadraoNomenclatura;
  onPadraoNomenclaturaChange: (value: PadraoNomenclatura) => void;
  anoLetivo: number;
  curriculumOverrides: Record<string, number>;
  onCurriculumOverridesChange: Dispatch<SetStateAction<Record<string, number>>>;
}
