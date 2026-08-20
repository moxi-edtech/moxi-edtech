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
  mensalidadesCompetencia?: string | null;
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

export type Aviso = {
  id: string;
  titulo: string;
  dataISO: string;
  /** Categorização do aviso para ícone e cor */
  tipo?: 'geral' | 'financeiro' | 'academico' | 'sistema' | 'urgente';
  /** Nível de prioridade — avisos 'alta' e 'urgente' aparecem primeiro */
  prioridade?: 'alta' | 'normal' | 'baixa';
  /** Resumo curto (1-2 linhas) — exibido no card */
  resumo?: string;
  /** Se o utilizador já visualizou o aviso */
  lido?: boolean;
  /** Label de acção contextual (ex: "Ver detalhes", "Resolver") */
  action_label?: string;
  /** Href de acção — ao clicar no CTA */
  action_href?: string;
  /** Nome de quem publicou o aviso */
  autor?: string;
};

export type Evento = { id: string; titulo: string; dataISO: string };

export type InadimplenciaTopRow = {
  aluno_id:        string;
  aluno_nome:      string;
  valor_em_atraso: number;
  dias_em_atraso:  number;
  /** Turma do aluno — para contexto rápido */
  turma_nome?:     string;
  /** Classe do aluno */
  classe_nome?:    string;
  /** Quantos títulos estão em atraso */
  titulos_em_atraso?: number;
  /** Data do último pagamento registado */
  ultimo_pagamento_data?: string;
  /** Tendência vs período anterior */
  tendencia?: 'piorando' | 'estavel' | 'melhorando';
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
  fase_operacional: 'PRE_INICIO' | 'REGULAR' | 'EXAMES' | 'POS_ENCERRAMENTO';
};
