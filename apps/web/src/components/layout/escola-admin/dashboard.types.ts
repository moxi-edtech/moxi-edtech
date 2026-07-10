// apps/web/src/components/layout/escola-admin/dashboard.types.ts

import type { SetupStatus } from "./setupStatus";
import type { PagamentosResumo } from "./definitions";

export type { SetupStatus, PagamentosResumo };

export type KpiStats = {
  turmas: number;
  alunos: number;
  professores: number;
  avaliacoes: number;
  financeiro?: number;
};

export type OperationalSnapshot = {
  mensalidadesPendentes: number;
  mensalidadesInadimplentes: number;
  turmasPendentes: number;
  curriculoHorarioPendencias: number;
  setupBlockers: number;
  admissoesPendentes: number;
  matriculasPendentes: number;
  documentosEmProcessamento: number;
  turmasSemHorarioPublicado: number;
  primeiraTurmaSemHorarioPublicadoId?: string | null;
};

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
  pendentesPorMes?: number[];
  inadimplentesPorMes?: number[];
  pagamentos:   PagamentosResumo;
  pagamentosValores?: {
    pago: number;
    pendente: number;
    inadimplente: number;
  };
};

export type EstadoVital = {
  escola_id: string;
  session_id: string | null;
  ano_ativo: number | null;
  periodo_id: string | null;
  periodo_tipo: string | null;
  periodo_numero: number | null;
  hoje_bloqueado_pedagogico: boolean;
  evento_hoje_nome: string | null;
  fase_operacional: 'REGULAR' | 'EXAMES';
};
