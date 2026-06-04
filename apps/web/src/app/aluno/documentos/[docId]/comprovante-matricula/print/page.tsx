import { ComprovanteMatriculaPrintDocument } from "@/app/secretaria/documentos/_print/ComprovanteMatriculaPrintDocument";

export const dynamic = "force-dynamic";

export default async function AlunoComprovanteMatriculaPrintPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  return <ComprovanteMatriculaPrintDocument docId={docId} requireStudentOwnership />;
}
