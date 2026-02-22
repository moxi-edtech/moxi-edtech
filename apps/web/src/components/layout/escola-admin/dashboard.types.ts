// apps/web/src/components/layout/escola-admin/dashboard.types.ts

import type { KpiStats }         from "./KpiSection";
import type { SetupStatus }      from "./setupStatus";
import type { PagamentosResumo } from "./definitions";

export type { KpiStats, SetupStatus, PagamentosResumo };

export type Aviso  = { id: string; titulo: string; dataISO: string };
export type Evento = { id: string; titulo: string; dataISO: string };

export type InadimplenciaTopRow = {
  aluno_id:        string;
  aluno_nome:      string;
  valor_em_atraso: number;
  dias_em_atraso:  number;
};

// aluno_nome required — API must JOIN alunos table
export type PagamentoRecenteRow = {
  id:         string;
  aluno_id:   string | null;
  aluno_nome: string | null;
  valor_pago: number | null;
  metodo:     string | null;
  status:     string | null;
  created_at: string | null;
};

export type CurriculoPendencias = {
  horario:   number;
  avaliacao: number;
};

export type DashboardCharts = {
  meses:        string[];
  alunosPorMes: number[];
  pagamentos:   PagamentosResumo;
};