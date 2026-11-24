import DeclaracaoNotasPrintPage from "@/app/secretaria/documentos/[docId]/notas/print/page";
export const dynamic = "force-dynamic";
export default function Page({ params }: { params: Promise<{ docId: string }> }) {
  return <DeclaracaoNotasPrintPage params={params} requireStudentOwnership />;
}
