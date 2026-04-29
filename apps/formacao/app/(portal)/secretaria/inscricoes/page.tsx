import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { InscricaoDiretaClient } from "./InscricaoDiretaClient";

export const dynamic = "force-dynamic";

export default async function SecretariaInscricoesPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_secretaria", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <InscricaoDiretaClient />
    </div>
  );
}
