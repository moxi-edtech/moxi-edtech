import { redirect } from "next/navigation";
import { resolveFormacaoSessionContext } from "@/lib/session-context";
import InfraestruturaClient from "./InfraestruturaClient";

export const dynamic = "force-dynamic";

export default async function InfraestruturaPage() {
  const session = await resolveFormacaoSessionContext();
  if (!session?.userId) redirect("/login");
  if (!session.tenantId) redirect("/forbidden");

  const role = String(session.role ?? "").trim().toLowerCase();
  if (!["formacao_admin", "formacao_secretaria", "super_admin", "global_admin"].includes(role)) {
    redirect("/forbidden");
  }

  return <InfraestruturaClient />;
}
