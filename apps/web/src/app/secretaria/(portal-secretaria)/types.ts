import type { PlanTier } from "@/config/plans";

export type DashboardCounts = {
  alunos: number;
  matriculas: number;
  turmas: number;
  pendencias: number;
};

export type DashboardRecentes = {
  pendencias: number;
  novas_matriculas: Array<{
    id: string;
    created_at: string;
    aluno: { nome: string };
    turma: { nome: string };
  }>;
  avisos_recentes: Array<{ id: string; titulo: string; resumo: string; data: string }>;
};

export type Plano = PlanTier | "enterprise";
