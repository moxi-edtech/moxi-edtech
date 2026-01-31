import {
  DashboardHeader,
  KpiCardSkeleton,
  ActionCard,
  SecondaryAction,
  TaskListSkeleton,
  NoticePanelSkeleton,
} from "@/components/dashboard";
import {
  Users, FileText, Banknote, CalendarX, FileEdit,
  UserPlus, Building, BarChart3,
  RefreshCcw, Upload, KeyRound,
  UserCheck,
  Clock
} from "lucide-react";

export function DashboardSkeleton() {
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
                  <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse"></div>
                  <div className="h-10 w-40 bg-slate-200 rounded-xl animate-pulse"></div>
                </div>
              }
            />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </div>

            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="h-4 w-48 bg-slate-200 rounded-md animate-pulse"></div>
                <div className="h-8 w-36 bg-slate-200 rounded-lg animate-pulse"></div>
              </div>
              <div className="h-10 w-full bg-slate-200 rounded-lg animate-pulse"></div>
              <div className="h-3 w-40 bg-slate-200 rounded-md animate-pulse mt-2"></div>
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
                        <div className="w-2 h-2 rounded-full bg-slate-200 animate-pulse"></div>
                        Atenção Necessária
                    </h3>
                    <div className="h-4 w-16 bg-slate-200 rounded-md animate-pulse"></div>
                </div>

                <TaskListSkeleton />

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
                <NoticePanelSkeleton />

                <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-lg animate-pulse">
                    <div className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-slate-700 rounded-full mt-0.5"></div>
                        <div>
                            <div className="h-5 w-32 bg-slate-700 rounded-md"></div>
                            <div className="h-4 w-full bg-slate-700 rounded-md mt-2"></div>
                            <div className="h-4 w-3/4 bg-slate-700 rounded-md mt-1"></div>
                            <div className="mt-3 h-8 w-24 bg-slate-700 rounded-lg"></div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/30 px-4 py-10">
        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="h-5 w-40 bg-slate-200 rounded-md animate-pulse"></div>
          </div>
          <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <div className="h-8 w-32 bg-slate-200 rounded-full animate-pulse"></div>
              <div className="h-24 bg-slate-200 rounded-xl animate-pulse"></div>
              <div className="h-24 bg-slate-200 rounded-xl animate-pulse"></div>
            </div>
            <div className="space-y-3">
              <div className="h-8 w-40 bg-slate-200 rounded-md animate-pulse"></div>
              <div className="h-10 bg-slate-200 rounded-lg animate-pulse"></div>
              <div className="h-20 bg-slate-200 rounded-lg animate-pulse"></div>
              <div className="h-10 bg-slate-200 rounded-lg animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/30 px-4 py-10">
        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="h-5 w-40 bg-slate-200 rounded-md animate-pulse"></div>
            <div className="mt-2 h-3 w-56 bg-slate-200 rounded-md animate-pulse"></div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="h-10 bg-slate-200 rounded-lg animate-pulse"></div>
            <div className="h-10 bg-slate-200 rounded-lg animate-pulse"></div>
            <div className="h-10 bg-slate-200 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
