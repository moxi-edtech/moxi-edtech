import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { PublicacaoClient } from "./PublicacaoClient";

export const dynamic = "force-dynamic";

export default async function AdminPublicacaoPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_admin", "formacao_secretaria", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return <PublicacaoClient />;
}
