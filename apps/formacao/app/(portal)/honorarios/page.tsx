import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import HonorariosClient from "./HonorariosClient";

export const dynamic = "force-dynamic";

export default async function HonorariosPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formador", "formacao_admin", "formacao_financeiro", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return <HonorariosClient role={String(auth.role)} userId={String(auth.userId)} />;
}
