import { redirect } from "next/navigation";

type SearchParams = { aluno?: string | string[]; ano_letivo_id?: string | string[] };

export default async function AlunoDisciplinasEscolaPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, input] = await Promise.all([params, searchParams]);
  const query = new URLSearchParams({ aba: "disciplinas" });
  if (typeof input.aluno === "string") query.set("aluno", input.aluno);
  if (typeof input.ano_letivo_id === "string") query.set("ano_letivo_id", input.ano_letivo_id);
  redirect(`/escola/${id}/aluno/academico?${query.toString()}`);
}
