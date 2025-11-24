"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { 
  Loader2, 
  Users, 
  BookOpen, 
  Building, 
  AlertTriangle,
  Calendar,
  Mail,
  UserCheck,
  BarChart3,
  ArrowRight,
  Eye,
  Settings
} from "lucide-react";

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
    const agg = new Map<string, { label: string; total: number; variant: StatusChip["variant"] }>();
    for (const item of data.resumo_status) {
      const norm = normalizeStatus((item.status ?? '').trim());
      const key = canonicalStatusKey((item.status ?? '').trim());
      const prev = agg.get(key);
      const total = (prev?.total ?? 0) + (item.total ?? 0);
      agg.set(key, { label: norm.label, total, variant: norm.context });
    }
    return Array.from(agg.entries()).map(([key, v]) => ({ status: key, label: v.label, total: v.total, variant: v.variant }));
  }, [data?.resumo_status]);

  function canonicalStatusKey(status: string) {
    const v = (status || '').trim().toLowerCase();
    if (["ativa", "ativo", "active"].includes(v)) return "ativo";
    if (["concluida", "concluido", "graduado"].includes(v)) return "concluido";
    if (["transferido", "transferida"].includes(v)) return "transferido";
    if (["pendente", "aguardando"].includes(v)) return "pendente";
    if (["trancado", "suspenso", "desistente", "inativo"].includes(v)) return "inativo";
    return v || 'indefinido';
  }

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-moxinexa-teal" />
          <div className="text-slate-600">Carregando painel da secretaria...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
        <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm">
          <h3 className="text-red-800 font-medium text-lg mb-2">Erro ao carregar dashboard</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
          >
            <Loader2 className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            Painel da Secretaria
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visão geral dos alunos, turmas e atividades recentes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-all">
            <BarChart3 className="h-4 w-4" />
            Relatório
          </button>
        </div>
      </div>

      {/* --- CARDS PRINCIPAIS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Alunos Ativos"
          value={data?.counts.alunos ?? 0}
          hint="Com matrícula ativa"
          icon={<Users className="h-6 w-6" />}
          color="text-moxinexa-navy"
          bgColor="bg-blue-50"
          href="/secretaria/matriculas?status_in=ativa,ativo,active"
        />
        <SummaryCard
          title="Total de Matrículas"
          value={data?.counts.matriculas ?? 0}
          hint="Histórico e vigentes"
          icon={<BookOpen className="h-6 w-6" />}
          color="text-orange-600"
          bgColor="bg-orange-50"
          href="/secretaria/matriculas"
        />
        <SummaryCard
          title="Turmas Ativas"
          value={data?.counts.turmas ?? 0}
          hint="Turmas disponíveis"
          icon={<Building className="h-6 w-6" />}
          color="text-moxinexa-teal"
          bgColor="bg-teal-50"
          href="/secretaria/turmas"
        />
        <SummaryCard
          title="Pendências"
          value={data?.counts.pendencias ?? 0}
          hint="Status a acompanhar"
          icon={<AlertTriangle className="h-6 w-6" />}
          color="text-red-600"
          bgColor="bg-red-50"
          emphasize
          href="/secretaria/matriculas?status_in=pendente,transferido,trancado,suspenso,desistente,inativo"
        />
      </div>

      {/* --- SITUAÇÃO DAS MATRÍCULAS --- */}
      {statusChips.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-moxinexa-navy flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Situação das Matrículas
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Distribuição dos estudantes por status acadêmico
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusChips.map((chip) => (
                <StatusBadge key={chip.status} label={chip.label} value={chip.total} variant={chip.variant} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statusChips.map((chip) => (
              <div key={chip.status} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">{chip.label}</p>
                  <span className="text-lg font-bold text-slate-900">{chip.total}</span>
                </div>
                <ProgressBar progress={calcPercentage(chip.total, data?.counts.matriculas ?? 0)} variant={chip.variant} />
                <div className="text-xs text-slate-500 mt-2">
                  {calcPercentage(chip.total, data?.counts.matriculas ?? 0)}% do total
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- CONTEÚDO PRINCIPAL --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TURMAS EM DESTAQUE */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-moxinexa-navy flex items-center gap-2">
              <Building className="h-5 w-5" />
              Turmas em Destaque
            </h3>
            <Link href="/secretaria/turmas" className="inline-flex items-center gap-2 text-sm text-moxinexa-teal hover:text-teal-600 transition-all">
              Ver todas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.turmas_destaque ?? []).map((turma) => (
              <TurmaCard key={turma.id} turma={turma} />
            ))}
            {data?.turmas_destaque?.length === 0 && (
              <div className="col-span-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                <Building className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <div className="text-slate-600">Nenhuma turma encontrada para esta escola.</div>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR - ATIVIDADES RECENTES */}
        <div className="space-y-6">
          {/* ÚLTIMAS MATRÍCULAS */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-moxinexa-navy flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Últimas Matrículas
              </h3>
              <Link href="/secretaria/matriculas" className="text-sm text-moxinexa-teal hover:text-teal-600">
                Ver todas
              </Link>
            </div>
            
            <div className="space-y-3">
              {(data?.novas_matriculas ?? []).map((item) => (
                <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 text-sm">{item.aluno.nome}</div>
                      <div className="text-xs text-slate-600">{item.turma.nome}</div>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString('pt-AO')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                      getStatusColor(item.status)
                    }`}>
                      {formatStatus(item.status)}
                    </span>
                    {item.aluno.email && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[120px]">{item.aluno.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {data?.novas_matriculas?.length === 0 && (
                <div className="text-center text-slate-500 text-sm py-4">
                  Nenhuma movimentação recente.
                </div>
              )}
            </div>
          </div>

          {/* AVISOS RECENTES */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-moxinexa-navy flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5" />
              Avisos Recentes
            </h3>
            
            {data?.avisos_recentes?.length ? (
              <div className="space-y-3">
                {data.avisos_recentes.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg border-l-4 border-emerald-500 bg-emerald-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-emerald-700">{a.origem}</span>
                      <span className="text-xs text-emerald-600">
                        {new Date(a.data).toLocaleDateString('pt-AO')}
                      </span>
                    </div>
                    <div className="font-semibold text-emerald-900 text-sm mb-1">{a.titulo}</div>
                    {a.resumo && (
                      <div className="text-xs text-emerald-800/80">{a.resumo}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 text-sm py-4">
                Nenhum aviso recente.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ 
  title, 
  value, 
  hint, 
  icon, 
  color, 
  bgColor, 
  emphasize, 
  href 
}: { 
  title: string; 
  value: number; 
  hint: string; 
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  emphasize?: boolean; 
  href?: string; 
}) {
  const content = (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md ${
      emphasize ? 'ring-2 ring-red-200' : ''
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-600 mb-1">{title}</div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{value}</div>
          <div className="text-xs text-slate-500">{hint}</div>
        </div>
        <div className={`p-3 rounded-lg ${bgColor} ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-moxinexa-teal rounded-xl">
      {content}
    </Link>
  ) : content;
}

function StatusBadge({ label, value, variant }: { label: string; value: number; variant: StatusChip["variant"] }) {
  const palette: Record<StatusChip["variant"], string> = {
    success: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    alert: 'bg-amber-100 text-amber-700 border border-amber-200',
    muted: 'bg-slate-100 text-slate-600 border border-slate-200',
    neutral: 'bg-blue-100 text-blue-700 border border-blue-200',
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${palette[variant]}`}>
      {label}
      <span className="bg-white/50 rounded-full px-1.5 py-0.5">{value}</span>
    </span>
  );
}

function ProgressBar({ progress, variant }: { progress: number; variant: StatusChip["variant"] }) {
  const color: Record<StatusChip["variant"], string> = {
    success: 'bg-emerald-500',
    alert: 'bg-amber-500',
    muted: 'bg-slate-400',
    neutral: 'bg-blue-500',
  };
  return (
    <div className="w-full bg-slate-200 rounded-full h-2">
      <div 
        className={`h-2 rounded-full transition-all duration-500 ${color[variant]}`} 
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} 
      />
    </div>
  );
}

function TurmaCard({ turma }: { turma: NonNullable<DashboardData["turmas_destaque"]>[number] }) {
  const professorNome = turma.professor?.nome || 'Sem diretor atribuído';
  const statusEntries = Object.entries(turma.status_counts || {});

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-moxinexa-navy text-sm">{turma.nome}</h4>
          <p className="text-xs text-slate-500 mt-1">
            {turma.turno ? `${turma.turno} • ` : ''}{turma.ano_letivo ?? 'Ano letivo não definido'}
          </p>
        </div>
        <span className="text-lg font-bold text-moxinexa-teal">{turma.total_alunos}</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
          <UserCheck className="h-3 w-3 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-slate-700 truncate">{professorNome}</div>
          {turma.professor?.email && (
            <div className="text-xs text-slate-500 truncate">{turma.professor.email}</div>
          )}
        </div>
      </div>

      {statusEntries.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {statusEntries.slice(0, 4).map(([status, total]) => {
            const norm = normalizeStatus(status);
            return (
              <div key={status} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{norm.label}</span>
                <span className="font-semibold text-slate-800">{total}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-slate-500 text-center py-2">
          Sem matrículas associadas
        </div>
      )}

      <Link 
        href={`/secretaria/turmas/${turma.id}`}
        className="inline-flex items-center gap-1 text-xs text-moxinexa-teal hover:text-teal-600 font-medium"
      >
        <Settings className="h-3 w-3" />
        Gerir turma
      </Link>
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

function getStatusColor(status: string) {
  const norm = normalizeStatus(status);
  const colors = {
    success: 'bg-emerald-100 text-emerald-700',
    alert: 'bg-amber-100 text-amber-700',
    muted: 'bg-slate-100 text-slate-700',
    neutral: 'bg-blue-100 text-blue-700',
  };
  return colors[norm.context];
}