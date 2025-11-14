"use client";

import EscolaAdminSidebar from "@/components/escola-admin/Sidebar";
import AppHeader from "@/components/layout/shared/AppHeader";
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
      <EscolaAdminSidebar escolaId={escolaId} />

      <div className="flex-1 p-6">
        <AppHeader title="Dashboard" />

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
