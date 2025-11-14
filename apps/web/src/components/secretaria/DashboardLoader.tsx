"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardData = {
  ok: boolean;
  counts: { alunos: number; matriculas: number; turmas: number; pendencias: number };
  resumo_status: Array<{ status: string; total: number }>;
  turmas_destaque: Array<{
    id: string;
    nome: string;
    turno: string | null;
    ano_letivo: string | null;
    total_alunos: number;
    status_counts: Record<string, number>;
    professor?: { nome: string | null; email: string | null };
  }>;
  novas_matriculas: Array<{
    id: string;
    status: string;
    created_at: string;
    turma: { id: string; nome: string; turno: string | null };
    aluno: { id: string | null; nome: string; email: string | null };
  }>;
  avisos_recentes: Array<{ id: string; titulo: string; resumo: string; origem: string; data: string }>;
};

type StatusChip = {
  label: string;
  status: string;
  total: number;
  variant: "success" | "alert" | "muted" | "neutral";
};

export default function SecretariaDashboardLoader() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/secretaria/dashboard', { cache: 'no-store' });
        const json = (await res.json()) as DashboardData;
        if (!res.ok || !json?.ok) throw new Error((json as any)?.error || 'Falha ao carregar dashboard');
        if (mounted) setData(json);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  const statusChips: StatusChip[] = useMemo(() => {
    if (!data?.resumo_status) return [];
    return data.resumo_status.map((item) => {
      const norm = normalizeStatus(item.status);
      return { label: norm.label, status: item.status, total: item.total, variant: norm.context };
    });
  }, [data?.resumo_status]);

  if (loading) return <div>Carregando painel…</div>;
  if (error) return <div className="text-red-600">Erro: {error}</div>;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-moxinexa-gray uppercase tracking-wide mb-3">Visão geral</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Alunos ativos" value={data?.counts.alunos ?? 0} hint="Perfis cadastrados" accent="from-sky-500/10 to-sky-200/40" icon="👩‍🎓" />
          <SummaryCard title="Matrículas" value={data?.counts.matriculas ?? 0} hint="Histórico e vigentes" accent="from-indigo-500/10 to-indigo-200/40" icon="📚" />
          <SummaryCard title="Turmas" value={data?.counts.turmas ?? 0} hint="Turmas disponíveis" accent="from-emerald-500/10 to-emerald-200/40" icon="🏫" />
          <SummaryCard title="Pendências" value={data?.counts.pendencias ?? 0} hint="Status a acompanhar" accent="from-amber-500/10 to-amber-200/40" icon="⚠️" emphasize />
        </div>
      </section>

      {statusChips.length > 0 && (
        <section className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-moxinexa-dark">Situação das matrículas</h3>
              <p className="text-sm text-moxinexa-gray">Acompanhe o estado académico dos estudantes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusChips.map((chip) => (
                <StatusBadge key={chip.status} label={chip.label} value={chip.total} variant={chip.variant} />
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statusChips.map((chip) => (
              <div key={chip.status} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase font-semibold text-slate-500">{chip.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{chip.total}</p>
                <ProgressBar progress={calcPercentage(chip.total, data?.counts.matriculas ?? 0)} variant={chip.variant} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-moxinexa-dark">Turmas em destaque</h3>
            <a href="/secretaria/turmas" className="text-sm text-emerald-600 hover:text-emerald-700">Ver todas as turmas</a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(data?.turmas_destaque ?? []).map((turma) => (
              <TurmaCard key={turma.id} turma={turma} />
            ))}
            {data?.turmas_destaque?.length === 0 && (
              <div className="col-span-full text-sm text-moxinexa-gray border border-dashed border-slate-300 rounded-xl p-6 bg-white">
                Nenhuma turma encontrada para esta escola.
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-moxinexa-dark">Últimas matrículas</h3>
              <a href="/secretaria/matriculas" className="text-xs text-emerald-600 hover:text-emerald-700">Ver lista completa</a>
            </div>
            <ul className="space-y-3">
              {(data?.novas_matriculas ?? []).map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="font-semibold text-slate-800">{item.aluno.nome}</p>
                      <p className="text-xs text-slate-500">{item.turma.nome}</p>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                    <span>{formatStatus(item.status)}</span>
                    {item.aluno.email && <span className="truncate max-w-[150px]">{item.aluno.email}</span>}
                  </div>
                </li>
              ))}
              {data?.novas_matriculas?.length === 0 && (
                <li className="text-sm text-slate-500">Nenhuma movimentação recente.</li>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-moxinexa-dark mb-3">Avisos recentes</h3>
            {data?.avisos_recentes?.length ? (
              <ul className="space-y-3">
                {data!.avisos_recentes.map((a) => (
                  <li key={a.id} className="border-l-4 border-emerald-500/70 bg-emerald-50/50 p-3 rounded">
                    <p className="text-xs text-emerald-700">{new Date(a.data).toLocaleDateString()}</p>
                    <p className="text-sm font-semibold text-emerald-900">{a.titulo}</p>
                    {a.resumo && <p className="text-xs text-emerald-800/70 mt-1">{a.resumo}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">Nenhum aviso.</div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ title, value, hint, accent, icon, emphasize }: { title: string; value: number; hint: string; accent: string; icon: string; emphasize?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${emphasize ? 'ring-1 ring-amber-100' : ''}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} aria-hidden />
      <div className="relative flex flex-col gap-2">
        <span className="text-2xl" aria-hidden>{icon}</span>
        <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{title}</span>
        <span className="text-3xl font-bold text-slate-900">{value}</span>
        <span className="text-xs text-slate-500">{hint}</span>
      </div>
    </div>
  );
}

function StatusBadge({ label, value, variant }: { label: string; value: number; variant: StatusChip["variant"] }) {
  const palette: Record<StatusChip["variant"], string> = {
    success: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    alert: 'bg-amber-100 text-amber-700 border border-amber-200',
    muted: 'bg-slate-100 text-slate-600 border border-slate-200',
    neutral: 'bg-slate-50 text-slate-600 border border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${palette[variant]}`}>
      {label}
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function ProgressBar({ progress, variant }: { progress: number; variant: StatusChip["variant"] }) {
  const color: Record<StatusChip["variant"], string> = {
    success: 'bg-emerald-500',
    alert: 'bg-amber-500',
    muted: 'bg-slate-400',
    neutral: 'bg-slate-300',
  };
  return (
    <div className="mt-3 h-2 rounded-full bg-slate-100">
      <div className={`h-2 rounded-full transition-all ${color[variant]}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
    </div>
  );
}

function TurmaCard({ turma }: { turma: NonNullable<DashboardData["turmas_destaque"]>[number] }) {
  const professorNome = turma.professor?.nome || 'Sem diretor atribuído';
  const statusEntries = Object.entries(turma.status_counts || {});

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col gap-3">
      <div>
        <h4 className="text-lg font-semibold text-slate-800">{turma.nome}</h4>
        <p className="text-xs text-slate-500">{turma.turno ? `${turma.turno} • ` : ''}{turma.ano_letivo ?? 'Ano letivo não definido'}</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">👩‍🏫</span>
        <div>
          <p className="font-medium text-slate-700">{professorNome}</p>
          {turma.professor?.email && <p className="text-[11px] text-slate-500">{turma.professor.email}</p>}
        </div>
      </div>
      <div className="text-sm text-slate-600">Total de alunos: <span className="font-semibold">{turma.total_alunos}</span></div>
      {statusEntries.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          {statusEntries.map(([status, total]) => {
            const norm = normalizeStatus(status);
            return (
              <div key={status} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1">
                <span>{norm.label}</span>
                <span className="font-semibold">{total}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Sem matrículas associadas.</p>
      )}
      <div className="flex items-center justify-between pt-2 text-xs text-emerald-600">
        <a href="/secretaria/turmas" className="hover:underline">Gerir turma</a>
        <span className="text-slate-400">Atualizado em tempo real</span>
      </div>
    </div>
  );
}

function normalizeStatus(status: string) {
  const value = (status || '').toLowerCase();
  if (["ativa", "ativo", "active"].includes(value)) return { label: "Ativo", context: "success" as const };
  if (["concluida", "concluido", "graduado"].includes(value)) return { label: "Concluído", context: "muted" as const };
  if (["transferido", "transferida"].includes(value)) return { label: "Transferido", context: "alert" as const };
  if (["pendente", "aguardando"].includes(value)) return { label: "Pendente", context: "alert" as const };
  if (["trancado", "suspenso", "desistente", "inativo"].includes(value)) return { label: "Irregular", context: "alert" as const };
  return { label: status || 'Indefinido', context: "neutral" as const };
}

function calcPercentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function formatStatus(status: string) {
  return normalizeStatus(status).label;
}

