import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import StudentReclassificationTool from "@/components/super-admin/StudentReclassificationTool";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="student_reclassification" />
      <DashboardHeader
        title="Operações de Alunos"
        description="Reclassificação de turma com atualização de propinas, pagamentos e auditoria."
      />
      <StudentReclassificationTool />
    </>
  );
}
