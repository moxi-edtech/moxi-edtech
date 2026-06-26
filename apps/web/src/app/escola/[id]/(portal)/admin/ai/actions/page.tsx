import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AI_ACTIONS_ACCESS_ROLES } from "@/lib/roles/ai-roles";
import AiActionsCenterClient from "./AiActionsCenterClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AiActionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (!user) {
    redirect("/login");
  }

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const schoolId = await resolveEscolaIdForUser(
    supabase as any,
    user.id,
    id,
    metaEscolaId ? String(metaEscolaId) : null
  );

  if (!schoolId) {
    redirect(`/escola/${id}/admin`);
  }

  const { data: roleData } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", schoolId)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = String(roleData?.papel ?? "").trim().toLowerCase();
  if (!AI_ACTIONS_ACCESS_ROLES.includes(role)) {
    redirect(`/escola/${id}/admin`);
  }

  return <AiActionsCenterClient schoolId={schoolId} />;
}
