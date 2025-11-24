"use client";

import KpiSection, { type KpiStats } from "./KpiSection";
import NoticesSection from "./NoticesSection";
import EventsSection from "./EventsSection";
import AcademicSection from "./AcademicSection";
import QuickActionsSection from "./QuickActionsSection";
import ChartsSection from "./ChartsSection";
import type { PagamentosResumo } from "./definitions";

type Props = {
  escolaId?: string;
  stats?: KpiStats;
  loading?: boolean;
  error?: string | null;
  notices?: Array<{ id: string; titulo: string; dataISO: string }>;
  events?: Array<{ id: string; titulo: string; dataISO: string }>;
  charts?: { meses: string[]; alunosPorMes: number[]; pagamentos: PagamentosResumo };
};

export default function EscolaAdminDashboardContent({ escolaId, stats, loading, error, notices, events, charts }: Props) {
  return (
    <>
      <KpiSection
        escolaId={escolaId}
        stats={stats ?? { turmas: 0, alunos: 0, professores: 0, avaliacoes: 0 }}
        loading={loading}
        error={error}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <NoticesSection notices={notices} />
        <EventsSection events={events} />
      </div>

      <AcademicSection />

      <div className="mt-6">
        <QuickActionsSection />
      </div>

      <ChartsSection meses={charts?.meses} alunosPorMes={charts?.alunosPorMes} pagamentos={charts?.pagamentos} />
    </>
  );
}
