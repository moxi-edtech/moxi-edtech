import { PORTAL_PAGE_HORIZONTAL_INSET } from "@/lib/layout/portal-page";
import ClassesListClient from "@/components/secretaria/ClassesListClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default function Page() {
  return (
    <div className="space-y-4">
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="classes_list" />
      <div className={`${PORTAL_PAGE_HORIZONTAL_INSET} pt-8`}>
      <DashboardHeader
        title="Classes"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Classes" },
        ]}
      />
      </div>
      <ClassesListClient />
    </div>
  );
}
