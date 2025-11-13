"use client";

import SidebarClient from "./SidebarClient";
import Header from "./Header";
import KpiSection, { type KpiStats } from "./KpiSection";
import NoticesSection from "./NoticesSection";
import EventsSection from "./EventsSection";
import AcademicSection from "./AcademicSection";
import ChartsSection from "./ChartsSection";

type Props = {
  escolaId: string;
  escolaNome?: string;
  stats?: KpiStats;
  loading?: boolean;
  error?: string | null;
};

export default function EscolaAdminDashboard({ escolaId, escolaNome, stats, loading, error }: Props) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <SidebarClient escolaId={escolaId} escolaNome={escolaNome} />

      {/* Conteúdo */}
      <div className="[margin-left:var(--escola-admin-sidebar-w,256px)] flex-1 p-6">
        <Header title="Dashboard" />

        {/* Cards principais */}
        <KpiSection
          stats={stats ?? { turmas: 0, alunos: 0, professores: 0, avaliacoes: 0 }}
          loading={loading}
          error={error}
        />

        {/* Avisos e eventos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <NoticesSection />
          <EventsSection />
        </div>

        {/* Acadêmico */}
        <AcademicSection />

        {/* Gráficos */}
        <ChartsSection />
      </div>
    </div>
  );
}
