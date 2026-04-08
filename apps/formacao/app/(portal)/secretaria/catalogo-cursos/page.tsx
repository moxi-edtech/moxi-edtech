import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import CatalogoCursosClient from "./CatalogoCursosClient";

export const dynamic = "force-dynamic";

export default async function SecretariaCatalogoCursosPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_secretaria", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return <CatalogoCursosClient />;
}
