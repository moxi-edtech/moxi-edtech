// apps/web/src/app/super-admin/escolas/[id]/hooks.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  EscolaDetalhes, 
  EscolaMetricas, 
  PerformanceMetrics, 
  AtividadeRecente, 
  AlertaEscola 
} from './types';

// Helper function moved outside the hook
const mapAuditActionToType = (acao: string): AtividadeRecente['tipo'] => {
  if (acao.includes('pagamento')) return 'pagamento';
  if (acao.includes('matricula')) return 'matricula';
  if (acao.includes('nota')) return 'nota';
  if (acao.includes('presenca')) return 'presenca';
  if (acao.includes('config')) return 'config';
  return 'outro';
};

export function useEscolaMonitorData(escolaId: string) {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [escola, setEscola] = useState<EscolaDetalhes | null>(null);
  const [metricas, setMetricas] = useState<EscolaMetricas | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);
  const [alertas, setAlertas] = useState<AlertaEscola[]>([]);

  const loadEscolaData = useCallback(async () => {
    if (!escolaId) return;

    try {
      setRefreshing(true);
      
      const { data: escolaData, error: escolaError } = await supabase
        .from('escolas')
        .select('*')
        .eq('id', escolaId)
        .single();
      
      if (escolaError) throw escolaError;
      setEscola(escolaData as EscolaDetalhes);
      
      const [metricasData, performanceData, atividadesData, alertasData] = await Promise.all([
        loadMetricas(supabase, escolaId),
        loadPerformance(supabase, escolaId),
        loadAtividades(supabase, escolaId),
        loadAlertas(supabase, escolaId)
      ]);
      
      setMetricas(metricasData);
      setPerformance(performanceData);
      setAtividades(atividadesData);
      setAlertas(alertasData);
      
    } catch (error) {
      console.error('Erro ao carregar dados da escola:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [escolaId, supabase]);

  useEffect(() => {
    loadEscolaData();
  }, [loadEscolaData]);

  return { loading, refreshing, escola, metricas, performance, atividades, alertas, loadEscolaData };
}

// Sub-fetching functions
async function loadMetricas(supabase: any, id: string): Promise<EscolaMetricas> {
  const { count: alunosAtivos } = await supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('escola_id', id).eq('status', 'ativo');
  const { count: alunosInativos } = await supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('escola_id', id).eq('status', 'inativo');
  const { count: professores } = await supabase.from('professores').select('*', { count: 'exact', head: true }).eq('escola_id', id);
  const { count: turmasAtivas } = await supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('escola_id', id).eq('status_validacao', 'ativo');
  const { count: turmasTotal } = await supabase.from('turmas').select('*', { count: 'exact', head: true }).eq('escola_id', id);
  const { count: matriculasAtivas } = await supabase.from('matriculas').select('*', { count: 'exact', head: true }).eq('escola_id', id).eq('status', 'ativa');
  
  const { data: aggregate } = await supabase.from('aggregates_financeiro').select('*').eq('escola_id', id).is('aluno_id', null).eq('data_referencia', new Date().toISOString().slice(0, 7) + '-01').single();
  const { data: ultimoPagamento } = await supabase.from('financeiro_lancamentos').select('created_at').eq('escola_id', id).eq('tipo', 'credito').eq('status', 'pago').order('created_at', { ascending: false }).limit(1).single();
  const { data: proximoVencimento } = await supabase.from('mensalidades').select('data_vencimento').eq('escola_id', id).eq('status', 'pendente').order('data_vencimento', { ascending: true }).limit(1).single();
  
  return {
    alunos_ativos: alunosAtivos || 0,
    alunos_inativos: alunosInativos || 0,
    alunos_total: (alunosAtivos || 0) + (alunosInativos || 0),
    professores: professores || 0,
    turmas_ativas: turmasAtivas || 0,
    turmas_total: turmasTotal || 0,
    matriculas_ativas: matriculasAtivas || 0,
    mensalidades_pendentes: 0,
    mensalidades_pagas: 0,
    valor_pendente: aggregate?.total_pendente || 0,
    valor_pago: aggregate?.total_pago || 0,
    inadimplentes: aggregate?.alunos_inadimplentes || 0,
    ultimo_pagamento: ultimoPagamento?.created_at || null,
    proximo_vencimento: proximoVencimento?.data_vencimento || null
  };
}

async function loadPerformance(supabase: any, id: string): Promise<PerformanceMetrics> {
  const { data: ultimoAcesso } = await supabase.from('audit_logs').select('created_at').eq('escola_id', id).order('created_at', { ascending: false }).limit(1).single();
  const { count: accessos24h } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('escola_id', id).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const { data: syncStatus } = await supabase.from('aggregates_financeiro').select('sync_status, sync_updated_at').eq('escola_id', id).is('aluno_id', null).order('sync_updated_at', { ascending: false }).limit(1).single();
  const { count: errorCount } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('escola_id', id).eq('acao', 'error').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const { data: lastError } = await supabase.from('audit_logs').select('mensagem').eq('escola_id', id).eq('acao', 'error').order('created_at', { ascending: false }).limit(1).single();

  return {
    latencia_media: 180, // Simulado
    ultimo_acesso: ultimoAcesso?.created_at || new Date().toISOString(),
    accessos_24h: accessos24h || 0,
    sync_status: syncStatus?.sync_status || 'synced',
    sync_updated_at: syncStatus?.sync_updated_at || new Date().toISOString(),
    api_calls_24h: 0, // Simulado
    storage_usage_mb: 0, // Simulado
    last_error: lastError?.mensagem || null,
    error_count_24h: errorCount || 0
  };
}

async function loadAtividades(supabase: any, id: string): Promise<AtividadeRecente[]> {
  const { data: auditLogs } = await supabase.from('audit_logs').select('*').eq('escola_id', id).order('created_at', { ascending: false }).limit(10);
  
  return (auditLogs || []).map((log: any) => ({
    id: log.id,
    tipo: mapAuditActionToType(log.acao),
    descricao: log.mensagem || log.acao,
    usuario: log.user_id?.slice(0, 8) || 'sistema',
    timestamp: log.created_at,
    detalhes: log.detalhes
  }));
}

async function loadAlertas(supabase: any, id: string): Promise<AlertaEscola[]> {
  const alertas: AlertaEscola[] = [];
  const metricas = await loadMetricas(supabase, id);
  const performance = await loadPerformance(supabase, id);
  
  if (metricas.inadimplentes > metricas.alunos_ativos * 0.3) {
    alertas.push({ id: 'inadimplencia-alta', nivel: 'alto', titulo: 'Taxa de inadimplência elevada', descricao: `${metricas.inadimplentes} alunos inadimplentes (${Math.round((metricas.inadimplentes / metricas.alunos_ativos) * 100)}%)`, criado_em: new Date().toISOString(), resolvido: false });
  }
  
  if (performance.sync_status === 'pending') {
    const minutosPendente = Math.floor((Date.now() - new Date(performance.sync_updated_at).getTime()) / 60000);
    if (minutosPendente > 5) {
      alertas.push({ id: 'sync-pendente', nivel: minutosPendente > 30 ? 'alto' : 'medio', titulo: 'Aggregates pendentes', descricao: `Sync pendente há ${minutosPendente} minutos`, criado_em: performance.sync_updated_at, resolvido: false });
    }
  }
  
  if (performance.error_count_24h > 10) {
    alertas.push({ id: 'erros-frequentes', nivel: 'alto', titulo: 'Erros frequentes', descricao: `${performance.error_count_24h} erros nas últimas 24h`, criado_em: new Date().toISOString(), resolvido: false });
  }
  
  return alertas;
}
