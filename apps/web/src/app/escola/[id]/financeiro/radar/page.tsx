import PortalLayout from "@/components/layout/PortalLayout";
import AuditPageView from "@/components/audit/AuditPageView";
import RadarInadimplenciaActive from "@/app/financeiro/_components/RadarInadimplenciaActive";

export default function RadarFinanceiroPage() {
  return (
    <PortalLayout>
      <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="radar" />
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Radar de Inadimplência</h1>
          <p className="text-sm text-slate-500">Cobranças em atraso e status por aluno.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <RadarInadimplenciaActive />
        </div>
      </div>
    </PortalLayout>
  );
}
