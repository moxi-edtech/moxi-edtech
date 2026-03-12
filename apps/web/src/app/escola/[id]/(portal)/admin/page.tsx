import EscolaAdminDashboard from "@/components/layout/escola-admin/EscolaAdminDashboard";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await props.params;
  const s = await supabaseServer();
  const { data: userRes } = await s.auth.getUser();
  const user = userRes?.user;
  let escolaNome: string | undefined = undefined;

  if (user) {
    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const resolved = await resolveEscolaIdForUser(
      s as any,
      user.id,
      escolaId,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (resolved) {
      const { data } = await s.from("escolas").select("nome").eq("id", resolved).maybeSingle();
      escolaNome = data?.nome ?? undefined;
    }
  }

  return <EscolaAdminDashboard escolaId={escolaId} escolaNome={escolaNome} />;
}
