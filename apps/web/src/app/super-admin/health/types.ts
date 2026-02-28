// apps/web/src/app/admin/health/types.ts

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  escolas_ativas: number;
  alunos_totais: number;
  professores_totais: number;
  outbox_pending: number;
  outbox_retry: number; // Mapped to 'failed' in frontend logic
  aggregates_synced: number;
  aggregates_pending: number;
  mrr_total: number;
}

export interface EscolaMetricas {
  id: string;
  nome: string;
  plano: 'essencial' | 'profissional';
  alunos_ativos: number;
  professores: number;
  turmas: number;
  ultimo_acesso: string;
  latencia_media: number | null;
  sync_status: 'synced' | 'pending' | 'error';
  mrr: number; // em AOA
  saude: number;
  dias_renovacao: number | null;
  onboarding_pct: number | null;
  provincia: string | null;
  alertas: EscolaAlerta[];
  nota_interna: string | null;
}

export interface EscolaAlerta {
  tipo: 'critico' | 'aviso' | 'info';
  msg: string;
}

export interface OutboxMetrics {
  pending: number;
  processing: number;
  retry: number;
  failed: number;
  oldest_pending_minutes: number;
}

export interface InfraMetrics {
  db_size_mb: number;
  db_size_limit_mb: number;
  api_calls_24h: number;
  api_calls_limit: number;
  bandwidth_mb: number;
  bandwidth_limit_mb: number;
}

export interface Alerta {
  id: string;
  nivel: 'critico' | 'alto' | 'medio' | 'baixo';
  titulo: string;
  descricao: string;
  escola_id?: string;
  escola_nome?: string;
  criado_em: string;
}
