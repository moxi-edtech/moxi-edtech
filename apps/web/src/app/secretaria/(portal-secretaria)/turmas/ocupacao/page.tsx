import OcupacaoClient from "@/components/secretaria/OcupacaoClient";
import AuditPageView from "@/components/audit/AuditPageView";

export default function Page() {
  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="turmas_ocupacao" />
      <OcupacaoClient />
    </>
  );
}
