import React from "react";

// Tipos de dados (AcademicSession, AcademicPeriod, etc.)
export type AcademicSession = {
  id: string;
  nome: string;
  ano_letivo: string;
  data_inicio: string;
  data_fim: string;
  status: string;
};

export type AcademicPeriod = {
  id: string;
  nome: string;
  numero: number;
  data_inicio: string;
  data_fim: string;
  sessao_id: string;
  tipo?: 'BIMESTRE' | 'TRIMESTRE' | 'SEMESTRE' | 'ANUAL' | string;
};

// Compat: manter alias antigo "Semester" para evitar break imediato
export type Semester = AcademicPeriod;

// Classe escolar
export type Class = {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number;
  nivel?: string; // base | secundario | medio | completo
  curso_id?: string;
  ano_letivo_id?: string;
  turno?: "M" | "T" | "N";
  carga_horaria_semanal?: number;
  min_disciplinas_core?: number;
  // Cada classe pode ter várias disciplinas associadas
  disciplinas?: Discipline[];
};

// Seção/Turma
export type Section = {
  id: string;
  nome: string;
  classe_id: string;
  capacidade: number;
  turma: string;
};

// Curso (usado no 2º ciclo / médio técnico-profissional)
export type Course = {
  id: string;
  nome: string;
  tipo: "core" | "eletivo";
  periodo_id: string;
  semestre_id?: string;
  professor_id?: string;
  nivel?: string;
  descricao?: string;
  disciplinas?: Discipline[]; // opcional: cursos também podem conter disciplinas
};

// Disciplina — pode estar vinculada a um curso OU a uma classe
export type Discipline = {
  id: string;
  nome: string;
  tipo: "core" | "eletivo";
  curso_id?: string;   // se pertence a um curso
  classe_id?: string;  // se pertence a uma classe diretamente
  descricao?: string;
  sigla?: string;
  carga_horaria_semana?: number;
  carga_horaria_semanal?: number;
  classificacao?: "core" | "complementar" | "optativa" | string;
  periodos_ativos?: number[];
  entra_no_horario?: boolean;
  avaliacao_mode?: "inherit_school" | "custom" | "inherit_disciplina" | string;
  avaliacao_modelo_id?: string;
  avaliacao_disciplina_id?: string;
  status_completude?: "completo" | "incompleto" | string;
  is_core?: boolean;
  is_avaliavel?: boolean;
  area?: string;
  aplica_modelo_avaliacao_id?: string;
  herda_de_disciplina_id?: string;
  curriculo_status?: "draft" | "published" | "archived" | string;
};

export type ModeloAvaliacao = {
  id: string;
  nome: string;
  componentes: Record<string, any>;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Teacher = {
  id: string;
  nome: string;
  email: string;
};

// Tipo para os passos do wizard
export type Step = {
  id: number;
  titulo: string;
  descricao: string;
  concluido: boolean;
  icone: React.ReactNode;
  componente: React.ReactNode;
};
