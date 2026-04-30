import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { RecebimentosClient } from "./RecebimentosClient";

export const dynamic = "force-dynamic";

export default async function FinanceiroRecebimentosPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_financeiro", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return <RecebimentosClient />;
}
