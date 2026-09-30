import FinalDocumentPrint from "../../_final/FinalDocumentPrint";
export const dynamic = "force-dynamic";
export default async function CertificadoPrintPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  return <FinalDocumentPrint docId={docId} expectedType="certificado" title="Certificado de Habilitações" />;
}
