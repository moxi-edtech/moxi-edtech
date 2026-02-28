import DiagnosticsDashboard from "@/components/super-admin/DiagnosticsDashboard";
import AuditPageView from "@/components/audit/AuditPageView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DiagnosticsPage() {
  return (
    <>
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="diagnostics" />
      <DiagnosticsDashboard />
    </>
  );
}
