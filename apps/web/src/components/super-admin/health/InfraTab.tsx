// apps/web/src/components/super-admin/health/InfraTab.tsx
'use client';

import { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import type { InfraMetrics } from '@/app/super-admin/health/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useConfirm, useToast } from '@/components/feedback/FeedbackSystem';
import { AlertTriangle, Clock3, Database, Download, HardDrive, RefreshCw, ScrollText, Trash2, Wrench } from 'lucide-react';

interface InfraTabProps {
  infraMetrics: InfraMetrics;
  onRefresh: () => void;
  onRunWorker: () => void;
  onRecalcAggregates: () => void;
  onForceRefreshFinancialMVs: () => void;
}

type MaintenanceWindow = {
  id: string;
  title: string;
  message: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'cancelled';
  maintenance_type: 'infra' | 'vacuum_full';
  banner_severity: 'warning' | 'critical';
  enforce_heavy_ops: boolean;
  phase: 'active' | 'scheduled';
};

function toLocalInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildDefaultWindowForm() {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);

  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  return {
    title: 'Manutenção programada',
    message: 'Manutenção em andamento. Alguns serviços podem ficar comprometidos durante esta janela.',
    startsAt: toLocalInputValue(start),
    endsAt: toLocalInputValue(end),
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function InfraTab({ 
  infraMetrics, 
  onRefresh, 
  onRunWorker, 
  onRecalcAggregates,
  onForceRefreshFinancialMVs
}: InfraTabProps) {
  const confirm = useConfirm();
  const { success, error } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [maintenanceWindow, setMaintenanceWindow] = useState<MaintenanceWindow | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState(buildDefaultWindowForm);

  const dbUsagePct = infraMetrics.db_size_limit_mb > 0
    ? Math.min(100, (infraMetrics.db_size_mb / infraMetrics.db_size_limit_mb) * 100)
    : 0;
  const storageUsagePct = infraMetrics.storage_limit_mb > 0
    ? Math.min(100, (infraMetrics.storage_mb / infraMetrics.storage_limit_mb) * 100)
    : 0;

  const tone =
    dbUsagePct >= 100 ? 'text-red-700' :
    dbUsagePct >= 90 ? 'text-amber-700' :
    'text-green-700';

  async function loadMaintenanceWindow() {
    try {
      const res = await fetch('/api/super-admin/infra/maintenance-window', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar janela de manutenção');
      setMaintenanceWindow(json.window ?? null);
    } catch {
      setMaintenanceWindow(null);
    }
  }

  useEffect(() => {
    void loadMaintenanceWindow();
  }, []);

  async function runCleanupDryRun() {
    try {
      setBusyAction('dry-run');
      const res = await fetch('/api/super-admin/infra/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execute: false }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao gerar dry-run');
      const candidates = json.candidates ?? {};
      success(
        'Dry-run concluído',
        `Cron success: ${Number(candidates.cron_succeeded ?? 0).toLocaleString('pt-AO')} · Cron failed: ${Number(candidates.cron_failed ?? 0).toLocaleString('pt-AO')} · Audit logs: ${Number(candidates.audit_logs ?? 0).toLocaleString('pt-AO')}`
      );
    } catch (e) {
      error('Falha no dry-run', e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setBusyAction(null);
    }
  }

  async function runCleanupExecute() {
    const ok = await confirm({
      title: 'Executar limpeza de retenção',
      message: 'Vamos apagar runs antigos de cron e audit logs antigos conforme a política atual. Esta ação remove dados históricos. Deseja continuar?',
      confirmLabel: 'Executar limpeza',
      variant: 'danger',
    });

    if (!ok) return;

    try {
      setBusyAction('execute-cleanup');
      const res = await fetch('/api/super-admin/infra/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execute: true }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao executar limpeza');
      const deleted = json.deleted ?? {};
      success(
        'Limpeza executada',
        `Removidos: cron success ${Number(deleted.cron_succeeded ?? 0).toLocaleString('pt-AO')}, cron failed ${Number(deleted.cron_failed ?? 0).toLocaleString('pt-AO')}, audit ${Number(deleted.audit_logs ?? 0).toLocaleString('pt-AO')}.`
      );
      onRefresh();
    } catch (e) {
      error('Falha na limpeza', e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setBusyAction(null);
    }
  }

  async function runAnalyze() {
    try {
      setBusyAction('analyze');
      const res = await fetch('/api/super-admin/infra/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao executar ANALYZE');
      success('ANALYZE executado', json?.message || 'Estatísticas atualizadas.');
      onRefresh();
    } catch (e) {
      error('Falha no ANALYZE', e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setBusyAction(null);
    }
  }

  async function runVacuum() {
    const ok = await confirm({
      title: 'Executar VACUUM',
      message: 'Vamos rodar VACUUM em cron.job_run_details e public.audit_logs. Isto é seguro, mas pode consumir recursos temporariamente. Deseja continuar?',
      confirmLabel: 'Executar VACUUM',
      variant: 'danger',
    });

    if (!ok) return;

    try {
      setBusyAction('vacuum');
      const res = await fetch('/api/super-admin/infra/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vacuum' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao executar VACUUM');
      success('VACUUM executado', json?.note || json?.message || 'Manutenção concluída.');
      onRefresh();
    } catch (e) {
      error('Falha no VACUUM', e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setBusyAction(null);
    }
  }

  async function runVacuumFull(target: 'cron.job_run_details' | 'public.audit_logs') {
    const typed = await confirm({
      title: 'Executar VACUUM FULL',
      message: `Esta operação pode bloquear a tabela ${target} durante a manutenção. Para confirmar, digite exatamente: ${target}`,
      confirmLabel: 'Executar VACUUM FULL',
      variant: 'danger',
      inputType: 'text',
      placeholder: target,
    });

    if (typed !== target) {
      if (typed !== null) {
        error('Confirmação inválida', 'O nome digitado não corresponde à tabela alvo.');
      }
      return;
    }

    try {
      setBusyAction(`vacuum-full:${target}`);
      const res = await fetch('/api/super-admin/infra/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vacuum_full', target }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const nextWindow = json?.next_window;
        const nextLabel = nextWindow?.starts_at
          ? ` Próxima janela: ${formatDateTime(nextWindow.starts_at)} até ${formatDateTime(nextWindow.ends_at)}.`
          : '';
        throw new Error((json?.error || 'Falha ao executar VACUUM FULL') + nextLabel);
      }
      success('VACUUM FULL executado', json?.note || json?.message || `Operação concluída em ${target}.`);
      onRefresh();
    } catch (e) {
      error(
        'Falha no VACUUM FULL',
        e instanceof Error ? e.message : 'Erro inesperado'
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function scheduleMaintenanceWindow() {
    const title = maintenanceForm.title.trim();
    const message = maintenanceForm.message.trim();
    if (title.length < 3 || message.length < 8) {
      error('Dados insuficientes', 'Preencha um título e uma mensagem operacional claros.');
      return;
    }

    try {
      setBusyAction('schedule-maintenance');
      const res = await fetch('/api/super-admin/infra/maintenance-window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          startsAt: maintenanceForm.startsAt,
          endsAt: maintenanceForm.endsAt,
          maintenanceType: 'vacuum_full',
          bannerSeverity: 'critical',
          enforceHeavyOps: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao agendar manutenção');
      success('Janela agendada', 'O banner global foi preparado e operações intrusivas passam a respeitar esta janela.');
      setMaintenanceWindow(json.window ?? null);
      onRefresh();
    } catch (e) {
      error('Falha ao agendar', e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setBusyAction(null);
    }
  }

  async function cancelMaintenanceWindow() {
    if (!maintenanceWindow?.id) return;

    const ok = await confirm({
      title: 'Cancelar janela de manutenção',
      message: 'Vamos cancelar a janela activa/agendada e remover o banner global. Deseja continuar?',
      confirmLabel: 'Cancelar janela',
      variant: 'danger',
    });

    if (!ok) return;

    try {
      setBusyAction('cancel-maintenance');
      const res = await fetch('/api/super-admin/infra/maintenance-window', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: maintenanceWindow.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao cancelar janela');
      success('Janela cancelada', 'O aviso global foi removido e o modo intrusivo voltou a ficar bloqueado.');
      setMaintenanceWindow(null);
      onRefresh();
    } catch (e) {
      error('Falha ao cancelar', e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Centro de ação
          </CardTitle>
          <CardDescription>Ações rápidas para investigar e estabilizar o uso da infraestrutura</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { onRefresh(); void loadMaintenanceWindow(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar métricas
            </Button>
            <Button variant="outline" onClick={onRunWorker}>
              <Database className="h-4 w-4 mr-2" />
              Executar worker
            </Button>
            <Button variant="outline" onClick={onRecalcAggregates}>
              <HardDrive className="h-4 w-4 mr-2" />
              Recalcular aggregates
            </Button>
            <Button variant="outline" onClick={onForceRefreshFinancialMVs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Forçar Dashboards (IO High)
            </Button>
            <Button variant="outline" asChild>
              <a href="/super-admin/diagnostics">
                <ScrollText className="h-4 w-4 mr-2" />
                Abrir diagnostics
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/super-admin/infra/usage" target="_blank" rel="noreferrer">
                <Database className="h-4 w-4 mr-2" />
                Exportar snapshot
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/super-admin/infra/audit-export?format=csv&days=90" target="_blank" rel="noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Exportar audit logs
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/super-admin/infra/cleanup-plan" target="_blank" rel="noreferrer">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Plano de limpeza
              </a>
            </Button>
            <Button variant="outline" onClick={() => void runCleanupDryRun()} disabled={busyAction !== null}>
              <ScrollText className="h-4 w-4 mr-2" />
              {busyAction === 'dry-run' ? 'A analisar...' : 'Dry-run limpeza'}
            </Button>
            <Button variant="destructive" onClick={() => void runCleanupExecute()} disabled={busyAction !== null}>
              <Trash2 className="h-4 w-4 mr-2" />
              {busyAction === 'execute-cleanup' ? 'A limpar...' : 'Executar limpeza'}
            </Button>
            <Button variant="outline" onClick={() => void runAnalyze()} disabled={busyAction !== null}>
              <Database className="h-4 w-4 mr-2" />
              {busyAction === 'analyze' ? 'A executar ANALYZE...' : 'Executar ANALYZE'}
            </Button>
            <Button variant="outline" onClick={() => void runVacuum()} disabled={busyAction !== null}>
              <HardDrive className="h-4 w-4 mr-2" />
              {busyAction === 'vacuum' ? 'A executar VACUUM...' : 'Executar VACUUM'}
            </Button>
            <Button
              variant="outline"
              onClick={() => void runVacuumFull('cron.job_run_details')}
              disabled={busyAction !== null}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {busyAction === 'vacuum-full:cron.job_run_details' ? 'A executar VACUUM FULL...' : 'VACUUM FULL Cron'}
            </Button>
            <Button
              variant="outline"
              onClick={() => void runVacuumFull('public.audit_logs')}
              disabled={busyAction !== null}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {busyAction === 'vacuum-full:public.audit_logs' ? 'A executar VACUUM FULL...' : 'VACUUM FULL Audit'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="h-5 w-5" />
            Janela de manutenção
          </CardTitle>
          <CardDescription>
            Agende dias e horas específicos para operações intrusivas. Durante a janela, todos os utilizadores recebem aviso global.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Título"
              value={maintenanceForm.title}
              onChange={(e) => setMaintenanceForm((current) => ({ ...current, title: e.target.value }))}
              placeholder="Ex: Manutenção programada"
            />
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              VACUUM FULL só executa dentro de uma janela activa com aviso global.
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Mensagem global</label>
              <textarea
                value={maintenanceForm.message}
                onChange={(e) => setMaintenanceForm((current) => ({ ...current, message: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-300 p-3 transition-colors duration-200 focus:border-teal-500 focus:ring-teal-500"
                placeholder="Manutenção em andamento. Alguns serviços podem ficar comprometidos durante esta janela."
              />
            </div>
            <Input
              label="Início"
              type="datetime-local"
              value={maintenanceForm.startsAt}
              onChange={(e) => setMaintenanceForm((current) => ({ ...current, startsAt: e.target.value }))}
            />
            <Input
              label="Fim"
              type="datetime-local"
              value={maintenanceForm.endsAt}
              onChange={(e) => setMaintenanceForm((current) => ({ ...current, endsAt: e.target.value }))}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void scheduleMaintenanceWindow()}
              disabled={busyAction !== null}
            >
              <Clock3 className="mr-2 h-4 w-4" />
              {busyAction === 'schedule-maintenance' ? 'A agendar...' : 'Agendar janela'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setMaintenanceForm(buildDefaultWindowForm())}
              disabled={busyAction !== null}
            >
              Restaurar sugestão
            </Button>
            <Button
              variant="destructive"
              onClick={() => void cancelMaintenanceWindow()}
              disabled={busyAction !== null || !maintenanceWindow}
            >
              {busyAction === 'cancel-maintenance' ? 'A cancelar...' : 'Cancelar janela'}
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            {maintenanceWindow ? (
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{maintenanceWindow.title}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    maintenanceWindow.phase === 'active'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-sky-100 text-sky-700'
                  }`}>
                    {maintenanceWindow.phase === 'active' ? 'Activa' : 'Agendada'}
                  </span>
                </div>
                <div>{maintenanceWindow.message}</div>
                <div>
                  Janela: {formatDateTime(maintenanceWindow.starts_at)} até {formatDateTime(maintenanceWindow.ends_at)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                Sem janela activa ou agendada. Operações intrusivas continuam bloqueadas fora do horário de manutenção.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database
            </CardTitle>
            <CardDescription>Uso real do PostgreSQL no Supabase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className={`text-2xl font-bold ${tone}`}>
                {infraMetrics.db_size_mb.toFixed(1)} MB
              </div>
              <div className="text-sm text-gray-500">
                Limite atual: {infraMetrics.db_size_limit_mb} MB
              </div>
              <Progress value={dbUsagePct} />
              <div className="text-xs text-gray-500">
                {dbUsagePct.toFixed(1)}% utilizado
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage
            </CardTitle>
            <CardDescription>Objetos guardados no bucket</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-2xl font-bold text-slate-700">
                {infraMetrics.storage_mb.toFixed(1)} MB
              </div>
              <div className="text-sm text-gray-500">
                Limite atual: {infraMetrics.storage_limit_mb} MB
              </div>
              <Progress value={storageUsagePct} />
              <div className="text-xs text-gray-500">
                {storageUsagePct.toFixed(1)}% utilizado
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Hotspots
            </CardTitle>
            <CardDescription>Fontes que mais pressionam a quota</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">cron.job_run_details</span>
                <span className="font-semibold text-slate-900">{infraMetrics.cron_job_run_details_mb.toFixed(1)} MB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">public.audit_logs</span>
                <span className="font-semibold text-slate-900">{infraMetrics.audit_logs_mb.toFixed(1)} MB</span>
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                O maior risco atual é retenção excessiva de cron e logs, não dados académicos.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top tabelas por tamanho</CardTitle>
            <CardDescription>Maiores consumidoras do PostgreSQL</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {infraMetrics.top_tables.map((table) => (
                <div key={table.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-gray-600 pr-4">{table.name}</span>
                  <span className="font-mono text-slate-900">{table.size_mb.toFixed(1)} MB</span>
                </div>
              ))}
              {infraMetrics.top_tables.length === 0 ? (
                <div className="text-sm text-gray-500">Sem dados de tabelas no momento.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Logs operacionais
            </CardTitle>
            <CardDescription>Distribuição do volume de auditoria e cron</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-slate-500">Runs de cron</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">{infraMetrics.cron_runs_total.toLocaleString('pt-AO')}</div>
                  <div className="text-xs text-rose-700">{infraMetrics.cron_failed_total.toLocaleString('pt-AO')} falhas</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-slate-500">Audit logs</div>
                  <div className="mt-1 text-xl font-semibold text-slate-900">{infraMetrics.audit_logs_total.toLocaleString('pt-AO')}</div>
                  <div className="text-xs text-slate-500">{infraMetrics.audit_logs_mb.toFixed(1)} MB</div>
                </div>
              </div>

              <div className="space-y-2">
                {infraMetrics.audit_by_portal.map((item) => (
                  <div key={item.portal} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{item.portal}</span>
                    <span className="font-medium text-slate-900">{item.total.toLocaleString('pt-AO')}</span>
                  </div>
                ))}
                {infraMetrics.audit_by_portal.length === 0 ? (
                  <div className="text-sm text-gray-500">Sem distribuição de auditoria.</div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plano de ação recomendado</CardTitle>
          <CardDescription>Próximos passos para evitar estouro de quota</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {infraMetrics.recommendations.map((item) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                {item}
              </div>
            ))}
            {infraMetrics.recommendations.length === 0 ? (
              <div className="text-sm text-gray-500">Sem recomendações críticas no momento.</div>
            ) : null}
            <div className="pt-2 text-xs text-gray-500">
              Use `Diagnostics` para investigação técnica e `Health` como cockpit de decisão operacional.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runbook de manutenção</CardTitle>
          <CardDescription>Sequência recomendada depois da limpeza lógica para recuperar estabilidade e espaço</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Fase 1 · Após limpeza</div>
              <div className="mt-2 text-sm text-slate-600">
                Rodar <span className="font-mono">ANALYZE cron.job_run_details</span> e <span className="font-mono">ANALYZE public.audit_logs</span> para atualizar estatísticas do planner.
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Fase 2 · Manutenção segura</div>
              <div className="mt-2 text-sm text-slate-600">
                Rodar <span className="font-mono">VACUUM</span> nessas tabelas para limpar dead tuples e melhorar performance. Isso nem sempre reduz o tamanho físico do banco imediatamente.
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">Fase 3 · Só se o tamanho continuar alto</div>
              <div className="mt-2 text-sm text-amber-800">
                Avaliar <span className="font-mono">VACUUM FULL</span> e eventualmente <span className="font-mono">REINDEX</span> para <span className="font-mono">cron.job_run_details</span> e depois <span className="font-mono">public.audit_logs</span>. Isso exige janela de manutenção porque pode bloquear tabela.
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Ordem operacional recomendada:
              <div className="mt-2 space-y-1">
                <div>1. Exportar snapshot e audit logs</div>
                <div>2. Rodar dry-run</div>
                <div>3. Executar limpeza</div>
                <div>4. Rodar ANALYZE</div>
                <div>5. Rodar VACUUM</div>
                <div>6. Reavaliar quota após atualização do Supabase</div>
                <div>7. Só então decidir sobre VACUUM FULL</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
