import ClassesListClient from "@/components/secretaria/ClassesListClient";
import AuditPageView from "@/components/audit/AuditPageView";

export default function Page() {
  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="classes_list" />
      <ClassesListClient />
    </>
  );
}
