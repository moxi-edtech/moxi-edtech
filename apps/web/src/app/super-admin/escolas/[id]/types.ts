// apps/web/src/app/super-admin/escolas/[id]/types.ts

export interface EscolaDetalhes {
  id: string;
  nome: string;
  nif: string;
  endereco: string;
  telefone?: string | null;
  email?: string | null;
  plano_atual: 'essencial' | 'profissional' | 'premium';
  status: string;
  created_at: string;
  updated_at: string;
  onboarding_finalizado: boolean;
  aluno_portal_enabled: boolean;
  logo_url: string;
  cor_primaria: string;
  dominio?: string | null;
  subdominio?: string | null;
  ssl_status?: string | null;
  db_region?: string | null;
}

export interface PlanLimits {
  plan: 'essencial' | 'profissional' | 'premium';
  price_mensal_kz: number;
  max_alunos: number | null;
  max_admin_users: number | null;
  max_storage_gb: number | null;
  professores_ilimitados: boolean;
  api_enabled: boolean;
  multi_campus: boolean;
}

export interface EscolaMetricas {
  alunos_ativos: number;
  alunos_inativos: number;
  alunos_total: number;
  professores: number;
  turmas_ativas: number;
  turmas_total: number;
  matriculas_ativas: number;
  mensalidades_pendentes: number;
  mensalidades_pagas: number;
  valor_pendente: number;
  valor_pago: number;
  inadimplentes: number;
  ultimo_pagamento: string | null;
  proximo_vencimento: string | null;
}

export interface PerformanceMetrics {
  latencia_media: number | null;
  ultimo_acesso: string;
  accessos_24h: number;
  sync_status: 'synced' | 'pending' | 'error';
  sync_updated_at: string;
  api_calls_24h: number | null;
  storage_usage_mb: number | null;
  last_error: string | null;
  error_count_24h: number;
}

export interface AtividadeRecente {
  id: string;
  tipo: 'pagamento' | 'matricula' | 'nota' | 'presenca' | 'config' | 'outro';
  descricao: string;
  usuario: string;
  timestamp: string;
  detalhes?: any;
}

export interface AlertaEscola {
  id: string;
  nivel: 'critico' | 'alto' | 'medio' | 'baixo';
  titulo: string;
  descricao: string;
  criado_em: string;
  resolvido: boolean;
}
