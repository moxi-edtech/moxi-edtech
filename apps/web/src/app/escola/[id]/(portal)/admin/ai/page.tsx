import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AI_ACTIONS_ACCESS_ROLES } from "@/lib/roles/ai-roles";
import KlasseAiCockpitClient from "./KlasseAiCockpitClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminAiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) redirect("/login");

  const metadataSchoolId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id;
  const schoolId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    id,
    metadataSchoolId ? String(metadataSchoolId) : null,
  );
  if (!schoolId) redirect(`/escola/${id}/admin`);

  const { data: roleData } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", schoolId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = String(roleData?.papel ?? "").trim().toLowerCase();
  if (!AI_ACTIONS_ACCESS_ROLES.includes(role)) redirect(`/escola/${id}/admin`);

  return <KlasseAiCockpitClient schoolId={schoolId} />;
}
