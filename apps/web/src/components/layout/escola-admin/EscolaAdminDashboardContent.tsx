// apps/web/src/components/layout/escola-admin/EscolaAdminDashboardContent.tsx

import Link from "next/link";
import { AlertCircle, ArrowRight, Wallet } from "lucide-react";

import KpiSection, { type KpiStats } from "./KpiSection";
import NoticesSection from "./NoticesSection";
import EventsSection from "./EventsSection";
import AcademicSection from "./AcademicSection";
import QuickActionsSection from "./QuickActionsSection";
import ChartsSection from "./ChartsSection";
import type { PagamentosResumo } from "./definitions";
import type { SetupStatus } from "./setupStatus";

type Aviso = { id: string; titulo: string; dataISO: string };
type Evento = { id: string; titulo: string; dataISO: string };
type InadimplenciaTopRow = {
  aluno_id: string;
  aluno_nome: string;
  valor_em_atraso: number;
  dias_em_atraso: number;
};
type PagamentoRecenteRow = {
  id: string;
  aluno_id: string | null;
  valor_pago: number | null;
  metodo: string | null;
  status: string | null;
  created_at: string | null;
};

type Props = {
  escolaId: string;
  escolaNome?: string;
  loading?: boolean;
  error?: string | null;
  notices?: Aviso[];
  events?: Evento[];
  charts?: { meses: string[]; alunosPorMes: number[]; pagamentos: PagamentosResumo };
  stats: KpiStats;
  pendingTurmasCount?: number | null;
  curriculoPendenciasHorarioCount?: number | null;
  curriculoPendenciasAvaliacaoCount?: number | null;
  setupStatus: SetupStatus;
  missingPricingCount?: number;
  financeiroHref?: string;
  pagamentosKpis?: any; // Add this line
  inadimplenciaTop?: InadimplenciaTopRow[];
  pagamentosRecentes?: PagamentoRecenteRow[];
};

export default function EscolaAdminDashboardContent({
  escolaId,
  escolaNome,
  loading,
  error,
  notices = [],
  events = [],
  charts,
  stats,
  pendingTurmasCount,
  curriculoPendenciasHorarioCount,
  curriculoPendenciasAvaliacaoCount,
  setupStatus,
  missingPricingCount = 0,
  financeiroHref,
  inadimplenciaTop = [],
  pagamentosRecentes = [],
}: Props) {
  const moeda = new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
  });
  const financeBase = financeiroHref ?? "/financeiro";

  return (
    <div className="space-y-8 pb-10">
      {/* Header & KPIs */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-sm font-medium text-slate-500">
              Visão geral{escolaNome ? ` — ${escolaNome}` : ""} da escola
            </p>
          </div>

          <div className="hidden md:block">
            <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm">
              Ano Letivo: 2024/2025
            </span>
          </div>
        </div>

        <KpiSection
          escolaId={escolaId}
          stats={stats}
          loading={loading}
          error={error}
          setupStatus={setupStatus}
          financeiroHref={financeiroHref}
        />

        {typeof pendingTurmasCount === "number" && pendingTurmasCount > 0 && (
          <div className="animate-in fade-in duration-500">
            <Link
              href={`/escola/${escolaId}/admin/turmas?status=pendente`}
              className="group flex items-center justify-between gap-4 p-5 rounded-3xl bg-orange-50 border border-orange-200 shadow-sm transition-all hover:border-orange-300 hover:shadow-md"
            >
              <div>
                <p className="text-sm font-bold text-orange-800">
                  {pendingTurmasCount} Turma{pendingTurmasCount > 1 ? "s" : ""} pendente
                  {pendingTurmasCount > 1 ? "s" : ""} de validação
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  Revise e aprove as turmas importadas/rascunho.
                </p>
              </div>

              <div className="flex-none w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center group-hover:bg-orange-200 transition">
                <ArrowRight className="h-5 w-5" />
              </div>
            </Link>
          </div>
        )}
      </div>

      <div className="space-y-8 animate-in fade-in duration-500">
        {typeof curriculoPendenciasHorarioCount === "number" && curriculoPendenciasHorarioCount > 0 && (
          <div className="animate-in fade-in duration-500">
            <Link
              href={`/escola/${escolaId}/admin/configuracoes/estrutura?resolvePendencias=1`}
              className="group flex items-center justify-between gap-4 p-5 rounded-3xl bg-amber-50 border border-amber-200 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
            >
              <div>
                <p className="text-sm font-bold text-amber-800">
                  Horários incompletos: {curriculoPendenciasHorarioCount} disciplina{curriculoPendenciasHorarioCount > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Ajuste a carga horária para liberar o quadro automático.
                </p>
              </div>

              <div className="flex-none w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center group-hover:bg-amber-200 transition">
                <ArrowRight className="h-5 w-5" />
              </div>
            </Link>
          </div>
        )}
        {typeof curriculoPendenciasAvaliacaoCount === "number" && curriculoPendenciasAvaliacaoCount > 0 && (
          <div className="animate-in fade-in duration-500">
            <Link
              href={`/escola/${escolaId}/admin/configuracoes/estrutura?resolvePendencias=1`}
              className="group flex items-center justify-between gap-4 p-5 rounded-3xl bg-amber-50 border border-amber-200 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
            >
              <div>
                <p className="text-sm font-bold text-amber-800">
                  Avaliação incompleta: {curriculoPendenciasAvaliacaoCount} disciplina{curriculoPendenciasAvaliacaoCount > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Configure avaliação para liberar lançamento de notas.
                </p>
              </div>

              <div className="flex-none w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center group-hover:bg-amber-200 transition">
                <ArrowRight className="h-5 w-5" />
              </div>
            </Link>
          </div>
        )}
        {/* Charts */}
        <ChartsSection meses={charts?.meses} alunosPorMes={charts?.alunosPorMes} pagamentos={charts?.pagamentos} />

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Pagamentos do dia</h2>
                  <p className="text-xs text-slate-500">Feed atualizado</p>
                </div>
              </div>
              <Link href={`${financeBase}/pagamentos`} className="text-xs font-semibold text-klasse-green-500 hover:underline">
                Ver todos
              </Link>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {pagamentosRecentes.length === 0 ? (
                <div className="py-6 text-sm text-slate-500">Nenhum pagamento hoje.</div>
              ) : (
                pagamentosRecentes.map((pagamento) => (
                  <div key={pagamento.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {pagamento.aluno_id ? `Aluno ${pagamento.aluno_id.slice(0, 8)}…` : "Aluno"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {pagamento.metodo ?? "—"} • {pagamento.status ?? "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">
                        {moeda.format(Number(pagamento.valor_pago ?? 0))}
                      </div>
                      <div className="text-xs text-slate-500">
                        {pagamento.created_at
                          ? new Date(pagamento.created_at).toLocaleTimeString("pt-PT", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Top inadimplentes</h2>
                  <p className="text-xs text-slate-500">Top 5 por valor em atraso</p>
                </div>
              </div>
              <Link href={`${financeBase}/radar`} className="text-xs font-semibold text-klasse-green-500 hover:underline">
                Ver lista completa
              </Link>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {inadimplenciaTop.length === 0 ? (
                <div className="py-6 text-sm text-slate-500">Nenhuma pendência encontrada.</div>
              ) : (
                inadimplenciaTop.map((row) => {
                  const nomeAluno = row.aluno_nome || "Aluno";
                  const iniciais = nomeAluno.trim().charAt(0).toUpperCase();
                  const dias = row.dias_em_atraso ? `${row.dias_em_atraso} dias` : "—";
                  return (
                    <div key={row.aluno_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold">
                          {iniciais}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{nomeAluno}</div>
                          <div className="text-xs text-slate-500">Em atraso: {dias}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-amber-700">
                          {moeda.format(Number(row.valor_em_atraso ?? 0))}
                        </div>
                        <div className="text-xs text-slate-500">Total em atraso</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* ✅ Layout anti-gap: duas colunas “stackadas” */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          {/* esquerda 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            <QuickActionsSection escolaId={escolaId} setupStatus={setupStatus} />
            <NoticesSection notices={notices} />
          </div>

          {/* direita 1/3 */}
          <div className="space-y-6">
            <AcademicSection
              escolaId={escolaId}
              setupStatus={setupStatus}
              missingPricingCount={missingPricingCount}
              financeiroHref={financeiroHref}
            />
            <EventsSection events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
