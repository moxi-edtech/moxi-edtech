"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Users, FileText, Banknote, CalendarX, FileEdit,
  AlertCircle, Bell,
  UserPlus, Building, BarChart3,
  RefreshCcw, Upload, Crown,
  LayoutDashboard, Clock, UserCheck
} from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { GlobalSearch } from "@/components/GlobalSearch";
import type { PlanTier } from "@/config/plans";
import {
  DashboardHeader,
  KpiCard,
  ActionCard,
  SecondaryAction,
  TaskList,
  NoticePanel,
} from "@/components/dashboard";


// --- TIPOS ---
type DashboardData = {
  ok: boolean;
  counts: { alunos: number; matriculas: number; turmas: number; pendencias: number };
  resumo_status: Array<{ status: string; total: number }>;
  turmas_destaque: Array<{ id: string; nome: string; total_alunos: number }>;
  novas_matriculas: Array<{
    id: string;
    created_at: string;
    aluno: { nome: string };
    turma: { nome: string };
  }>;
  avisos_recentes: Array<{ id: string; titulo: string; resumo: string; data: string }>;
};

type Plano = PlanTier | "enterprise";


export default function SecretariaDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { escolaId, isLoading: escolaLoading } = useEscolaId();
  
  // Mock de permissões e plano (em prod viriam do contexto)
  const [plan] = useState<Plano>('profissional');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/secretaria/dashboard', { cache: 'no-store' });
        const json = await res.json();
        if (mounted) {
            if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar');
            setData(json);
        }
      } catch (e: any) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-slate-900" />
            <p className="text-sm text-slate-500 font-medium">A preparar o balcão...</p>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (error) {
    return (
      <div className="p-8 flex justify-center">
        <div className="bg-red-50 p-6 rounded-2xl border border-red-200 max-w-md text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3"/>
          <h3 className="text-red-900 font-bold">Erro de Conexão</h3>
          <p className="text-red-700 text-sm mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-bold text-red-700 hover:bg-red-50">
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* HEADER */}
      <header className="flex-none h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 sticky top-0">
        <div className="flex items-center gap-8 w-full max-w-3xl">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                <LayoutDashboard className="w-4 h-4"/>
             </div>
             <span className="font-bold text-lg tracking-tight hidden md:block">Secretaria</span>
          </div>

          <GlobalSearch
            escolaId={escolaId}
            placeholder="Buscar aluno, matrícula ou documento..."
            disabledText={escolaLoading ? "Carregando escola..." : "Vincule-se a uma escola para pesquisar"}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
             <span className="text-xs font-bold text-slate-700">Maria Silva</span>
             <span className="text-[10px] text-slate-400 uppercase tracking-wide">Secretária Chefe</span>
          </div>
          <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition">
            <Bell className="w-5 h-5" />
            {data?.counts.pendencias ? (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            ) : null}
          </button>
          <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold border-2 border-white shadow-sm">
            MS
          </div>
        </div>
      </header>

      {/* LAYOUT PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* COLUNA PRINCIPAL (Esquerda + Centro) */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-32 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-8">
                <DashboardHeader
                  title="Secretaria"
                  description="Resumo operacional do dia"
                  breadcrumbs={[
                    { label: "Início", href: "/app" },
                    { label: "Secretaria" },
                  ]}
                  actions={
                    <>
                      <Link
                        href="/secretaria/matriculas?nova=1"
                        className="
                          inline-flex items-center gap-2
                          rounded-xl bg-klasse-gold px-4 py-2
                          text-sm font-semibold text-white
                          hover:brightness-95
                          focus:outline-none focus:ring-4 focus:ring-klasse-gold/20
                        "
                      >
                        Nova Matrícula
                      </Link>
                    </>
                  }
                />
                
                {/* 1. KPI CARDS (Resumo do Dia) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard label="Total Alunos" value={data?.counts.alunos} icon={Users} variant="brand" />
                    <KpiCard label="Matrículas Hoje" value={data?.counts.matriculas} icon={UserPlus} variant="success" />
                    <KpiCard label="Turmas Ativas" value={data?.counts.turmas} icon={Building} />
                    <KpiCard label="Pendências" value={data?.counts.pendencias} icon={AlertCircle} variant="warning" />
                </div>

                {/* 2. BALCÃO DE ATENDIMENTO (Ações Rápidas) */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 ml-1">Balcão de Atendimento</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <ActionCard title="Matricular" sub="Novo ou Confirmação" icon={UserPlus} href="/secretaria/matriculas?nova=1" />
                        <ActionCard title="Emitir Declaração" sub="Com ou sem notas" icon={FileText} href="/secretaria/documentos" />
                        <ActionCard title="Cobrar Propina" sub="Pagamento Rápido" icon={Banknote} href="/secretaria/financeiro" />
                        <ActionCard title="Justificar Falta" sub="Registar ausência" icon={CalendarX} href="/secretaria/faltas" />
                        <ActionCard title="Lançar Nota" sub="Pauta Rápida" icon={FileEdit} href="/secretaria/notas" />
                    </div>
                </div>

                {/* 3. INBOX DE TAREFAS (Grid Dividido) */}
                <div className="grid lg:grid-cols-3 gap-8">
                    
                    {/* Coluna Esquerda: Tarefas & Pendências */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                Atenção Necessária
                            </h3>
                            <button className="text-xs font-bold text-teal-600 hover:text-teal-700">Ver tudo</button>
                        </div>

                        <TaskList items={data?.novas_matriculas ?? []} />

                        {/* Atalhos Secundários */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 ml-1">Gestão</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <SecondaryAction icon={Users} label="Alunos" href="/secretaria/alunos" />
                                <SecondaryAction icon={UserCheck} label="Professores" href="/secretaria/professores" />
                                <SecondaryAction icon={Building} label="Turmas" href="/secretaria/turmas" />
                                <SecondaryAction icon={BarChart3} label="Relatórios" href="/secretaria/relatorios" />
                                <SecondaryAction icon={RefreshCcw} label="Rematrículas" href="/secretaria/rematricula" />
                                <SecondaryAction icon={Upload} label="Migração" href="/migracao/alunos" highlight={true} />
                            </div>
                        </div>
                    </div>

                    {/* Coluna Direita: Avisos e Histórico */}
                    <div className="space-y-6">
                        
                        {/* Quadro de Avisos */}
                        <NoticePanel items={data?.avisos_recentes ?? []} />

                        {/* Lembrete Operacional */}
                        <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-lg">
                            <div className="flex items-start gap-3">
                                <Clock className="w-5 h-5 text-teal-400 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-bold">Fecho do Trimestre</h3>
                                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                        Faltam <strong>5 dias</strong> para o fecho das pautas. Verifique os professores com notas em atraso.
                                    </p>
                                    <button className="mt-3 text-[10px] font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition">
                                        Ver Pautas Pendentes
                                     </button>
                                </div>
                            </div>
                        </div>

                        {/* Upgrade (Se Essencial) */}
                        {plan === 'essencial' && (
                            <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center hover:bg-slate-50 transition cursor-pointer group">
                                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition">
                                    <Crown className="w-5 h-5" />
                                </div>
                                <p className="text-xs font-bold text-slate-700">Plano Profissional</p>
                                <p className="text-[10px] text-slate-500 mt-1">Ative para ter relatórios financeiros avançados.</p>
                            </div>
                        )}

                    </div>

                </div>

            </div>
        </main>
      </div>
    </div>
  );
}
