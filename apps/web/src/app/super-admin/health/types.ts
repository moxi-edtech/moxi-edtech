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
  storage_mb: number;
  storage_limit_mb: number;
  api_calls_24h: number | null;
  api_calls_limit: number | null;
  bandwidth_mb: number;
  bandwidth_limit_mb: number;
  top_tables: Array<{
    name: string;
    size_mb: number;
  }>;
  cron_job_run_details_mb: number;
  cron_runs_total: number;
  cron_failed_total: number;
  cron_oldest_at: string | null;
  cron_newest_at: string | null;
  audit_logs_mb: number;
  audit_logs_total: number;
  audit_oldest_at: string | null;
  audit_newest_at: string | null;
  audit_by_portal: Array<{
    portal: string;
    total: number;
  }>;
  recommendations: string[];
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
