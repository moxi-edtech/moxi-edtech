import { redirect } from "next/navigation";

export default async function AlunoDisciplinasEscolaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/escola/${id}/aluno/academico`);
}
