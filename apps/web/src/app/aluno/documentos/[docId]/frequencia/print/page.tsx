import FrequencyPrintPage from "@/app/secretaria/documentos/[docId]/frequencia/print/page";
import { getDocumentoEmitido } from "@/app/secretaria/documentos/_print/getDocumento";

export const dynamic = "force-dynamic";

export default async function AlunoFrequencyPrintPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const ownership = await getDocumentoEmitido(docId, { requireStudentOwnership: true });
  if ("error" in ownership) return <div className="p-8">{ownership.error}</div>;
  return <FrequencyPrintPage params={Promise.resolve({ docId })} />;
}
