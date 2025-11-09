import Mermaid from "@/components/Mermaid";
import AuditPageView from "@/components/audit/AuditPageView";
import { fluxoAcademico } from "@/lib/diagrams";

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="fluxo_academico" />
      <h1 className="text-xl font-semibold mb-4">Fluxo Acadêmico</h1>
      <Mermaid chart={fluxoAcademico} className="overflow-auto rounded-lg border bg-white p-4" />
    </>
  );
}

