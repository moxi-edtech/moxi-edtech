import StudentPortalLayout from "@/components/layout/StudentPortalLayout"
import AuditPageView from "@/components/audit/AuditPageView"

export default function Page() {
  return (
    <StudentPortalLayout>
      <AuditPageView portal="aluno" action="PAGE_VIEW" entity="financeiro" />
      <div className="text-sm text-gray-600">Em breve: Seus boletos e status de pagamentos.</div>
    </StudentPortalLayout>
  )
}

