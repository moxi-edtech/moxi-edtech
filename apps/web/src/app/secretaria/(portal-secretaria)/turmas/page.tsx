import AuditPageView from "@/components/audit/AuditPageView";
import TurmasListClient from "@/components/secretaria/TurmasListClient";

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="turmas_list" />
      <TurmasListClient />
    </>
  );
}
