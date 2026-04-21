import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import EquipaFormadoresClient from "./EquipaFormadoresClient";

export const dynamic = "force-dynamic";

export default async function EquipaPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return <EquipaFormadoresClient />;
}

