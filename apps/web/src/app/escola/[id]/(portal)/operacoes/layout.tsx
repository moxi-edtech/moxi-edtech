import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { roleMatchesAllowedRoles } from "@/lib/permissions";
import { K12_OPERACOES_ROLE_GROUP } from "@/lib/roles";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export default async function OperacoesEscolaLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const metadataEscolaId =
    (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const escolaId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    id,
    metadataEscolaId ? String(metadataEscolaId) : null
  );

  if (!escolaId) notFound();

  const [{ data: isSuperAdmin }, { data: membership }] = await Promise.all([
    supabase.rpc("check_super_admin_role"),
    supabase
      .from("escola_users")
      .select("papel, role")
      .eq("escola_id", escolaId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const papel = membership?.papel ?? membership?.role ?? null;
  const hasOperacoesAccess =
    isSuperAdmin === true ||
    roleMatchesAllowedRoles(papel, K12_OPERACOES_ROLE_GROUP, "k12");

  if (!hasOperacoesAccess) notFound();

  return <>{children}</>;
}
