import { redirect } from "next/navigation";

export default async function AlunoEscolaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/escola/${id}/aluno/dashboard`);
}
