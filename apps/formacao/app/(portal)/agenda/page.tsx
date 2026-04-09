import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import AgendaClient from "./AgendaClient";

export const dynamic = "force-dynamic";

export default async function AgendaFormadorPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formador", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return <AgendaClient />;
}
