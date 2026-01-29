import { redirect } from "next/navigation";

export default async function FichaAlunoRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/secretaria/alunos/${id}`);
}
