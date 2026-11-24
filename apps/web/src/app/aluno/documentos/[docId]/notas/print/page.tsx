import DeclaracaoNotasPrintPage from "@/app/secretaria/documentos/_print/DeclaracaoNotasPrintPage";
export const dynamic = "force-dynamic";
export default function Page({ params }: { params: Promise<{ docId: string }> }) {
  return <DeclaracaoNotasPrintPage params={params} requireStudentOwnership />;
}
