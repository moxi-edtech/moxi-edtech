import FinalDocumentPrint from "@/app/aluno/documentos/[docId]/_final/FinalDocumentPrint";
export const dynamic = "force-dynamic";
export default async function SecretariaCertificadoPrintPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  return <FinalDocumentPrint docId={docId} expectedType="certificado" title="Certificado de Habilitações" requireStudentOwnership={false} />;
}
