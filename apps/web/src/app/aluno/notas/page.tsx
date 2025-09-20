import StudentPortalLayout from "@/components/layout/StudentPortalLayout"
import AuditPageView from "@/components/audit/AuditPageView"

export default function Page() {
  return (
    <StudentPortalLayout>
      <AuditPageView portal="aluno" action="PAGE_VIEW" entity="notas" />
      <div className="text-sm text-gray-600">Em breve: Suas notas e histórico de avaliações.</div>
    </StudentPortalLayout>
  )
}

