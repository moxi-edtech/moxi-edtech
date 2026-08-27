import FinalDocumentPrint from "../../_final/FinalDocumentPrint";
export const dynamic = "force-dynamic";
export default async function HistoricoPrintPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  return <FinalDocumentPrint docId={docId} expectedType="historico" title="Histórico Escolar" />;
}
