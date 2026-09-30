import StudentDocumentPrintPage from "@/app/secretaria/documentos/[docId]/cartao/print/page";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";

export const dynamic = "force-dynamic";
export default async function AlunoCartaoPrintPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const ownership = await getDocumentoEmitido(docId, { requireStudentOwnership: true });
  if ("error" in ownership) return <div className="p-8">{ownership.error}</div>;
  return <StudentDocumentPrintPage params={Promise.resolve({ docId })} />;
}
