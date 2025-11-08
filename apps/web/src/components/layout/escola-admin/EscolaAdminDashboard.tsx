import Sidebar from "./Sidebar";
import Header from "./Header";
import KpiSection from "./KpiSection";
import NoticesSection from "./NoticesSection";
import EventsSection from "./EventsSection";
import AcademicSection from "./AcademicSection";
import QuickActionsSection from "./QuickActionsSection";
import ChartsSection from "./ChartsSection";

export default function EscolaAdminDashboard() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <Header title="Dashboard" />

        <KpiSection/>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <NoticesSection />
          <EventsSection />
        </div>

        <AcademicSection />

        <div className="mt-6">
          <QuickActionsSection />
        </div>

        <ChartsSection />
      </main>
    </div>
  );
}
