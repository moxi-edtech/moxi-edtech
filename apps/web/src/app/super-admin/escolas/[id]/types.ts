// apps/web/src/app/super-admin/escolas/[id]/types.ts

export interface EscolaDetalhes {
  id: string;
  nome: string;
  nif: string;
  endereco: string;
  telefone: string;
  email: string;
  plano_atual: 'essencial' | 'profissional';
  status: string;
  created_at: string;
  updated_at: string;
  onboarding_finalizado: boolean;
  aluno_portal_enabled: boolean;
  logo_url: string;
  cor_primaria: string;
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
  latencia_media: number;
  ultimo_acesso: string;
  accessos_24h: number;
  sync_status: 'synced' | 'pending' | 'error';
  sync_updated_at: string;
  api_calls_24h: number;
  storage_usage_mb: number;
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
