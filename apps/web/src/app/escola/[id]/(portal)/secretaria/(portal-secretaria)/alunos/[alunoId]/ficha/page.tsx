import { redirect } from "next/navigation";

export default async function EscolaFichaAlunoRedirect({
  params,
}: {
  params: Promise<{ id: string; alunoId: string }>;
}) {
  const { id, alunoId } = await params;
  redirect(`/escola/${id}/secretaria/alunos/${alunoId}`);
}
