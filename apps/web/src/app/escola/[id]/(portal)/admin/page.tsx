import EscolaAdminDashboard from "@/components/layout/escola-admin/EscolaAdminDashboard";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

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
      const { data } = await s.from("escolas").select("nome").eq("id", resolvedEscolaId).maybeSingle();
      escolaNome = data?.nome ?? undefined;
    }
  }

  return <EscolaAdminDashboard escolaId={resolvedEscolaId ?? escolaParam} escolaNome={escolaNome} />;
}
