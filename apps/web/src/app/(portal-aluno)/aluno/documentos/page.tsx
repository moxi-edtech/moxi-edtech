import AuditPageView from "@/components/audit/AuditPageView";
import { TabDocumentos } from "@/components/aluno/tabs/TabDocumentos";

export default function DocumentosPage() {
  return (
    <div className="space-y-4 bg-slate-50">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="documentos" />
      <TabDocumentos />
    </div>
  );
}
