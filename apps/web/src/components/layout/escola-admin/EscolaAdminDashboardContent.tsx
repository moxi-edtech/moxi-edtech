// apps/web/src/components/layout/escola-admin/EscolaAdminDashboardContent.tsx

import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
  curriculoPendenciasCount?: number | null;
  setupStatus: SetupStatus;
  missingPricingCount?: number;
  financeiroHref?: string;
  pagamentosKpis?: any; // Add this line
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
  curriculoPendenciasCount,
  setupStatus,
  missingPricingCount = 0,
  financeiroHref,
}: Props) {
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
        {typeof curriculoPendenciasCount === "number" && curriculoPendenciasCount > 0 && (
          <div className="animate-in fade-in duration-500">
            <Link
              href={`/escola/${escolaId}/admin/configuracoes/estrutura?resolvePendencias=1`}
              className="group flex items-center justify-between gap-4 p-5 rounded-3xl bg-amber-50 border border-amber-200 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
            >
              <div>
                <p className="text-sm font-bold text-amber-800">
                  Faltam detalhes em {curriculoPendenciasCount} disciplina{curriculoPendenciasCount > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Ajuste cargas, períodos e avaliação para liberar a publicação do currículo.
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
