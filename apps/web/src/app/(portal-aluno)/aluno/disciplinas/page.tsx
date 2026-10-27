import { redirect } from "next/navigation";
import { resolveCurrentEscolaParam } from "@/lib/tenant/resolveCurrentEscolaParam";

type SearchParams = { aluno?: string | string[]; ano_letivo_id?: string | string[] };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const escolaParam = await resolveCurrentEscolaParam();
  if (!escolaParam) redirect("/redirect");
  const input = await searchParams;
  const query = new URLSearchParams({ aba: "disciplinas" });
  if (typeof input.aluno === "string") query.set("aluno", input.aluno);
  if (typeof input.ano_letivo_id === "string") query.set("ano_letivo_id", input.ano_letivo_id);
  redirect(`/escola/${escolaParam}/aluno/academico?${query.toString()}`);
}
