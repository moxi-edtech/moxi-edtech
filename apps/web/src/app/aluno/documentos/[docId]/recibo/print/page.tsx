import { ReciboPrintDocument } from "@/app/secretaria/documentos/_print/ReciboPrintDocument";

export const dynamic = "force-dynamic";

export default async function AlunoReciboPrintPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  return <ReciboPrintDocument docId={docId} requireStudentOwnership />;
}
