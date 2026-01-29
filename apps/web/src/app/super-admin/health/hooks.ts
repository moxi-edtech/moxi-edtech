// apps/web/src/app/super-admin/health/hooks.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabaseClient';
import type { SystemHealth, EscolaMetricas, OutboxMetrics, InfraMetrics, Alerta } from './types';
import { runOutboxWorker, recalcAllAggregates } from './actions';

export function useHealthData() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    escolas_ativas: 0,
    alunos_totais: 0,
    professores_totais: 0,
    outbox_pending: 0,
    outbox_retry: 0,
    aggregates_synced: 0,
    aggregates_pending: 0,
    mrr_total: 0,
  });
  
  const [escolas, setEscolas] = useState<EscolaMetricas[]>([]);
  const [outboxMetrics, setOutboxMetrics] = useState<OutboxMetrics>({
    pending: 0,
    processing: 0,
    retry: 0,
    failed: 0,
    oldest_pending_minutes: 0
  });
  
  const [infraMetrics, setInfraMetrics] = useState<InfraMetrics>({
    db_size_mb: 0,
    db_size_limit_mb: 500, // Free tier
    api_calls_24h: 0,
    api_calls_limit: 50000,
    bandwidth_mb: 0,
    bandwidth_limit_mb: 1024
  });
  
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  const loadHealthData = useCallback(async () => {
    try {
      setRefreshing(true);
      
      const { data: systemHealthDataRaw, error: systemHealthError } = await supabase.rpc('admin_get_system_health');
      if (systemHealthError) {
        console.error('Erro ao carregar health summary:', systemHealthError);
      }
      const systemHealthData = systemHealthDataRaw as any;

      const { data: escolasComMetricasRaw, error: escolasMetricsError } = await supabase.rpc('admin_get_escola_health_metrics');
      if (escolasMetricsError) {
        console.error('Erro ao carregar métricas por escola:', escolasMetricsError);
      }

      const escolasComMetricas: EscolaMetricas[] = (escolasComMetricasRaw as any[] || []).map(raw => ({
        id: raw.id,
        nome: raw.nome,
        plano: raw.plano,
        alunos_ativos: raw.alunos_ativos,
        professores: raw.professores,
        turmas: raw.turmas,
        ultimo_acesso: raw.ultimo_acesso,
        latencia_media: raw.latencia_media, // Still simulated for now
        sync_status: raw.sync_status,
        mrr: raw.mrr
      }));
      setEscolas(escolasComMetricas);

      const { data: outboxData } = await supabase
        .from('outbox_events')
        .select('status, created_at')
        .in('status', ['pending', 'processing', 'failed']);

      const pending = outboxData?.filter(e => e.status === 'pending').length || 0;
      const processing = outboxData?.filter(e => e.status === 'processing').length || 0;
      const failed = outboxData?.filter(e => e.status === 'failed').length || 0;
      const retry = failed; // We mapped retry to failed

      const oldestPending = outboxData
        ?.filter(e => e.status === 'pending')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      const oldestPendingMinutes = oldestPending ? Math.floor((Date.now() - new Date(oldestPending.created_at).getTime()) / 60000) : 0;

      setOutboxMetrics({ pending, processing, retry, failed, oldest_pending_minutes: oldestPendingMinutes });

      const alunosTotais = escolasComMetricas.reduce((sum, escola) => sum + escola.alunos_ativos, 0);
      const professoresTotais = escolasComMetricas.reduce((sum, escola) => sum + escola.professores, 0);
      const mrrTotal = escolasComMetricas.reduce((sum, escola) => sum + escola.mrr, 0);
      const aggregatesSynced = escolasComMetricas.filter((escola) => escola.sync_status === 'synced').length;
      const aggregatesPending = escolasComMetricas.filter((escola) => escola.sync_status !== 'synced').length;

      let healthStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (failed > 5 || oldestPendingMinutes > 60) {
        healthStatus = 'critical';
      } else if (pending > 20 || retry > 10) {
        healthStatus = 'degraded';
      }
      setSystemHealth({
        status: healthStatus,
        timestamp: systemHealthData?.last_updated ?? new Date().toISOString(),
        escolas_ativas: systemHealthData?.escolas_ativas ?? escolasComMetricas.length,
        alunos_totais: systemHealthData?.alunos_totais ?? alunosTotais,
        professores_totais: systemHealthData?.professores_totais ?? professoresTotais,
        outbox_pending: pending,
        outbox_retry: retry,
        aggregates_synced: systemHealthData?.aggregates_synced ?? aggregatesSynced,
        aggregates_pending: systemHealthData?.aggregates_pending ?? aggregatesPending,
        mrr_total: systemHealthData?.mrr_total ?? mrrTotal,
      });


      const novosAlertas: Alerta[] = [];
      escolasComMetricas.forEach(escola => {
        if (escola.latencia_media > 500) {
          novosAlertas.push({
            id: `latencia-${escola.id}`,
            nivel: escola.latencia_media > 1000 ? 'critico' : 'alto',
            titulo: `Latência elevada: ${escola.nome}`,
            descricao: `Latência média de ${escola.latencia_media}ms`,
            escola_id: escola.id,
            escola_nome: escola.nome,
            criado_em: new Date().toISOString()
          });
        }
      });
      if (oldestPendingMinutes > 30) {
        novosAlertas.push({
          id: 'outbox-stuck',
          nivel: oldestPendingMinutes > 120 ? 'critico' : 'alto',
          titulo: 'Outbox com eventos antigos',
          descricao: `Evento mais antigo pendente há ${oldestPendingMinutes} minutos`,
          criado_em: new Date().toISOString()
        });
      }
      setAlertas(novosAlertas);

      setLastUpdated(new Date().toLocaleTimeString('pt-AO'));
      
    } catch (error) {
      console.error('Erro ao carregar health data:', error);
      // Aqui você pode adicionar um estado de erro para mostrar na UI
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadHealthData();
    const interval = setInterval(loadHealthData, 30000);
    return () => clearInterval(interval);
  }, [loadHealthData]);

  const handleRecalcAggregates = async () => {
    if (!confirm('Recalcular aggregates de TODAS as escolas? Isso pode levar alguns minutos.')) return;
    try {
      await recalcAllAggregates();
      alert('Aggregates em recálculo! Os dashboards atualizarão em alguns minutos.');
      loadHealthData();
    } catch (error) {
      console.error('Erro ao recalcular:', error);
      alert('Erro ao iniciar recálculo');
    }
  };

  const handleRunOutboxWorker = async () => {
    try {
      const result = await runOutboxWorker();
      if(result.data) {
        const data = result.data as any[];
         alert(`Worker executado: ${data[0]?.processed_count || 0} processados, ${data[0]?.failed_count || 0} falhas`);
      }
      loadHealthData();
    } catch (error) {
      console.error('Erro ao executar worker:', error);
      alert('Erro ao executar worker');
    }
  };
  
  return {
    loading,
    refreshing,
    lastUpdated,
    systemHealth,
    escolas,
    outboxMetrics,
    infraMetrics,
    alertas,
    loadHealthData,
    handleRecalcAggregates,
    handleRunOutboxWorker,
  };
}
