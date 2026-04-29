import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import AdminCohortsPageClient from "@/components/cohorts/AdminCohortsPageClient";

export const dynamic = "force-dynamic";

export default async function SecretariaTurmasPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  // Apenas secretaria e admins acessam esta visão operacional
  if (!["formacao_secretaria", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return <AdminCohortsPageClient />;
}
