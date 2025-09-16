// src/app/super-admin/dashboard/page.tsx
import PortalLayout from "@/components/layout/PortalLayout";
import KpiSection from "@/components/super-admin/KpiSection";
import ChartsSection from "@/components/super-admin/ChartsSection";
import ActivitiesSection from "@/components/super-admin/ActivitiesSection";
import QuickActionsSection from "@/components/super-admin/QuickActionsSection";

export default function SuperAdminDashboard() {
  return (
    <PortalLayout>
      {/* Alerta de compliance */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-xl mb-6 shadow-sm">
        <p className="font-semibold">Atenção</p>
        <p className="text-sm mt-1">
          Monitorando o uso do SaaS: lembre-se que o papel do Super Admin é{" "}
          <span className="font-bold">governança, auditoria e configuração global</span>.  
          Nenhuma ação operacional em turmas, notas ou pagamentos pode ser feita aqui.
        </p>
      </div>

      {/* KPIs globais */}
      <KpiSection />

     {/* Gráficos */}
<ChartsSection escolaId="global" /> 


      {/* Grid de atividades + ações rápidas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ActivitiesSection activities={[]} />
        <QuickActionsSection />
      </div>
    </PortalLayout>
  );
}
