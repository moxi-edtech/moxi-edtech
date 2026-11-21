import AuditPageView from "@/components/audit/AuditPageView";
import { TabDocumentos } from "@/components/aluno/tabs/TabDocumentos";

export default function DocumentosPage() {
  return (
    <div className="min-w-0 space-y-4">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="documentos" />
      <TabDocumentos />
    </div>
  );
}
