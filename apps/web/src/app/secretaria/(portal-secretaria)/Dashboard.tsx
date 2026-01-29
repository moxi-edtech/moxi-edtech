"use client";
import Link from "next/link";
import {
  Users, FileText, Banknote, CalendarX, FileEdit,
  AlertCircle,
  UserPlus, Building, BarChart3,
  RefreshCcw, Upload, Crown,
  Clock, UserCheck, KeyRound
} from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BuscaBalcaoRapido } from "@/components/secretaria/BuscaBalcaoRapido";
import type { PlanTier } from "@/config/plans";
import {
  DashboardHeader,
  KpiCard,
  ActionCard,
  SecondaryAction,
  TaskList,
  NoticePanel,
} from "@/components/dashboard";
import type { DashboardCounts, DashboardRecentes, Plano } from "./types";

export function Dashboard({
  counts,
  recentes,
  plan,
}: {
  counts: DashboardCounts | null;
  recentes: DashboardRecentes | null;
  plan: Plano;
}) {
  const { escolaId, isLoading: escolaLoading } = useEscolaId();

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
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
                <div className="flex flex-col gap-3 items-stretch sm:flex-row sm:items-center sm:justify-end">
                  <GlobalSearch
                    escolaId={escolaId}
                    portal="secretaria"
                    placeholder="Buscar aluno, matrícula ou documento..."
                    disabledText={escolaLoading ? "Carregando escola..." : "Vincule-se a uma escola para pesquisar"}
                  />
                  <Link
                    href="/secretaria/admissoes?nova=1"
                    className="
                      inline-flex items-center justify-center gap-2
                      rounded-xl bg-klasse-gold px-4 py-2
                      text-sm font-semibold text-white
                      hover:brightness-95
                      focus:outline-none focus:ring-4 focus:ring-klasse-gold/20
                    "
                  >
                    Nova Matrícula
                  </Link>
                </div>
              }
            />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Total Alunos" value={counts?.alunos} icon={Users} variant="brand" />
                <KpiCard label="Matrículas Hoje" value={counts?.matriculas} icon={UserPlus} variant="success" />
                <KpiCard label="Turmas Ativas" value={counts?.turmas} icon={Building} />
                <KpiCard label="Pendências" value={recentes?.pendencias ?? counts?.pendencias} icon={AlertCircle} variant="warning" />
            </div>

            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                🔍 Busca Rápida para Atendimento
              </h3>
              <BuscaBalcaoRapido escolaId={escolaId} />
              <p className="text-xs text-gray-500 mt-2">
                Digite BI, nome completo ou telefone do encarregado
              </p>
            </div>

            <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 ml-1">Balcão de Atendimento</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <ActionCard title="Matricular" sub="Novo ou Confirmação" icon={UserPlus} href="/secretaria/admissoes?nova=1" />
                    <ActionCard title="Emitir Declaração" sub="Com ou sem notas" icon={FileText} href="/secretaria/documentos" />
                    <ActionCard title="Cobrar Propina" sub="Pagamento Rápido" icon={Banknote} href="/secretaria/financeiro" />
                    <ActionCard title="Justificar Falta" sub="Registar ausência" icon={CalendarX} href="/secretaria/faltas" />
                    <ActionCard title="Lançar Nota" sub="Pauta Rápida" icon={FileEdit} href="/secretaria/notas" />
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                        Atenção Necessária
                    </h3>
                    <button className="text-xs font-bold text-teal-600 hover:text-teal-700">Ver tudo</button>
                </div>

                <TaskList items={recentes?.novas_matriculas ?? []} />

                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 ml-1">Gestão</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <SecondaryAction icon={Users} label="Alunos" href="/secretaria/alunos" />
                        <SecondaryAction icon={UserCheck} label="Professores" href="/secretaria/professores" />
                        <SecondaryAction icon={Building} label="Turmas" href="/secretaria/turmas" />
                        <SecondaryAction icon={BarChart3} label="Relatórios" href="/secretaria/relatorios" />
                        <SecondaryAction icon={RefreshCcw} label="Rematrículas" href="/secretaria/rematricula" />
                        <SecondaryAction icon={KeyRound} label="Acesso Alunos" href="/secretaria/acesso-alunos" />
                        <SecondaryAction icon={Upload} label="Migração" href="/migracao/alunos" highlight={true} />
                        <SecondaryAction icon={Users} label="Usuários Globais" href="/secretaria/usuarios/globais" />
                    </div>
                </div>
              </div>

              <div className="space-y-6">
                <NoticePanel items={recentes?.avisos_recentes ?? []} />

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
