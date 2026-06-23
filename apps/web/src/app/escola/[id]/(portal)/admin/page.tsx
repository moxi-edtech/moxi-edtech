import EscolaAdminDashboard from "@/components/layout/escola-admin/EscolaAdminDashboard";
import { getDefaultK12PortalPathForRole } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id: escolaParam } = await props.params;
  const s = await supabaseServer();
  const { data: userRes } = await s.auth.getUser();
  const user = userRes?.user;
  let resolvedEscolaId: string | null = null;
  let escolaNome: string | undefined = undefined;

  if (user) {
    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    resolvedEscolaId = await resolveEscolaIdForUser(
      s as any,
      user.id,
      escolaParam,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (resolvedEscolaId) {
      const { data: vinculo } = await s
        .from("escola_users")
        .select("papel")
        .eq("escola_id", resolvedEscolaId)
        .eq("user_id", user.id)
        .maybeSingle();
      const papel = String(vinculo?.papel ?? "").trim().toLowerCase();
      if (papel === "admin_financeiro") {
        redirect(getDefaultK12PortalPathForRole(papel, escolaParam));
      }

      const { data } = await s.from("escolas").select("nome").eq("id", resolvedEscolaId).maybeSingle();
      escolaNome = data?.nome ?? undefined;
    }
  }

  return <EscolaAdminDashboard escolaId={resolvedEscolaId ?? escolaParam} escolaNome={escolaNome} />;
}
