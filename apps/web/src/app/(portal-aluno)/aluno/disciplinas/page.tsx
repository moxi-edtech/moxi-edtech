import { redirect } from "next/navigation";
import { resolveCurrentEscolaParam } from "@/lib/tenant/resolveCurrentEscolaParam";

export default async function Page() {
  const escolaParam = await resolveCurrentEscolaParam();
  redirect(escolaParam ? `/escola/${escolaParam}/aluno/academico` : "/redirect");
}
