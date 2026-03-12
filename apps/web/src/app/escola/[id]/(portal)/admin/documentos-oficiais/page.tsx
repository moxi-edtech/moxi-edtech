import AuditPageView from "@/components/audit/AuditPageView";
import DocumentosOficiaisBatchClient from "@/components/secretaria/DocumentosOficiaisBatchClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <AuditPageView portal="admin_escola" acao="PAGE_VIEW" entity="documentos_oficiais" />
      <DocumentosOficiaisBatchClient />
    </>
  );
}
