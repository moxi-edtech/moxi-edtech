import EscolaAdminDashboard from "@/components/layout/escola-admin/EscolaAdminDashboard";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { id: escolaParam } = await params;
  const s = await supabaseServer();
  const { data: userRes } = await s.auth.getUser();
  const user = userRes?.user;
  let escolaNome: string | undefined = undefined;
  const resolvedParam = await resolveEscolaParam(s as any, escolaParam);
  const resolvedEscolaId = resolvedParam.escolaId ?? escolaParam;

  if (resolvedParam.paramType === "uuid" && resolvedParam.slug) {
    const query = new URLSearchParams();
    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((entry) => query.append(key, entry));
        } else if (value !== undefined) {
          query.set(key, value);
        }
      });
    }
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : "";
    redirect(`/escola/${resolvedParam.slug}/admin/dashboard${suffix}`);
  }

  if (user) {
    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const resolved = await resolveEscolaIdForUser(
      s as any,
      user.id,
      escolaParam,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (resolved) {
      const { data } = await s.from("escolas").select("nome").eq("id", resolved).maybeSingle();
      escolaNome = data?.nome ?? undefined;
    }
  }

  return <EscolaAdminDashboard escolaId={resolvedEscolaId} escolaNome={escolaNome} />;
}
