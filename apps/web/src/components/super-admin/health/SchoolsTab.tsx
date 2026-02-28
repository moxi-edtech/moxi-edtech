// apps/web/src/components/super-admin/health/SchoolsTab.tsx
'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { EscolaMetricas } from '@/app/super-admin/health/types';

interface SchoolsTabProps {
  escolas: EscolaMetricas[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA',
    minimumFractionDigits: 0,
  }).format(value);

const formatRelative = (value: string) => {
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return 'Em construção';
  const diffHours = (Date.now() - parsed) / (1000 * 60 * 60);
  if (diffHours < 24) return `há ${Math.max(1, Math.round(diffHours))}h`;
  return `há ${Math.round(diffHours / 24)}d`;
};

const healthColor = (score: number) => {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-400';
  return 'bg-rose-500';
};

export function SchoolsTab({ escolas }: SchoolsTabProps) {
  const [selecionada, setSelecionada] = useState<EscolaMetricas | null>(null);
  const sorted = useMemo(() => [...escolas].sort((a, b) => a.saude - b.saude), [escolas]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-3">
        {sorted.map((escola) => {
          const isSelected = selecionada?.id === escola.id;
          return (
            <button
              key={escola.id}
              onClick={() => setSelecionada(escola)}
              className={`rounded-xl border p-4 text-left transition ${
                isSelected
                  ? 'border-klasse-green bg-klasse-green/5 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-klasse-green/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{escola.nome}</p>
                  <p className="text-xs text-slate-500">
                    {escola.provincia ?? 'Em construção'} · {escola.plano}
                  </p>
                </div>
                <Badge
                  className={
                    escola.sync_status === 'synced'
                      ? 'bg-emerald-100 text-emerald-700'
                      : escola.sync_status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                  }
                >
                  {escola.sync_status}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="h-1 flex-1 rounded-full bg-slate-100">
                  <div
                    className={`h-1 rounded-full ${healthColor(escola.saude)}`}
                    style={{ width: `${escola.saude}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700">{escola.saude}%</span>
                <span className="text-xs text-slate-400">{formatRelative(escola.ultimo_acesso)}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span><strong className="text-slate-700">{escola.alunos_ativos}</strong> alunos</span>
                <span>·</span>
                <span>{formatCurrency(escola.mrr)}/mês</span>
                <span>·</span>
                <span>
                  Renovação: {escola.dias_renovacao === null ? 'Em construção' : `${escola.dias_renovacao}d`}
                </span>
              </div>

              {escola.alertas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {escola.alertas.map((alerta, idx) => (
                    <span
                      key={`${escola.id}-alerta-${idx}`}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        alerta.tipo === 'critico'
                          ? 'bg-rose-100 text-rose-700'
                          : alerta.tipo === 'aviso'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {alerta.msg}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selecionada && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{selecionada.nome}</p>
              <p className="text-xs text-slate-500">
                {selecionada.provincia ?? 'Em construção'} · {selecionada.plano}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelecionada(null)}>
              Fechar
            </Button>
          </div>

          <div className="mt-4 grid gap-3 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <span>Saúde</span>
              <span className="font-semibold text-slate-800">{selecionada.saude}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Onboarding</span>
              <span className="font-semibold text-slate-800">
                {selecionada.onboarding_pct === null ? 'Em construção' : `${selecionada.onboarding_pct}%`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Alunos</span>
              <span className="font-semibold text-slate-800">{selecionada.alunos_ativos}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Professores</span>
              <span className="font-semibold text-slate-800">{selecionada.professores}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Turmas</span>
              <span className="font-semibold text-slate-800">{selecionada.turmas}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>MRR</span>
              <span className="font-semibold text-slate-800">{formatCurrency(selecionada.mrr)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Renovação</span>
              <span className="font-semibold text-slate-800">
                {selecionada.dias_renovacao === null ? 'Em construção' : `${selecionada.dias_renovacao}d`}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-700">Nota interna</p>
            <p className="mt-1 text-xs text-slate-500">
              {selecionada.nota_interna?.trim() || 'Sem nota interna ainda.'}
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <Button size="sm" asChild>
              <a href={`/super-admin/escolas/${selecionada.id}`}>Abrir detalhes</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/admin/login-as?escola_id=${selecionada.id}`}>Acessar como</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
