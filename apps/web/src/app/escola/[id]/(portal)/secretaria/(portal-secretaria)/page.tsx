import SecretariaDashboardPage from "@/app/secretaria/(portal-secretaria)/page";
import { getDefaultK12PortalPathForRole } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { redirect } from "next/navigation";

export default async function SecretariaLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ aluno?: string; view?: string; modo?: string }>;
}) {
  const { id: escolaParam } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <SecretariaDashboardPage />;

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const resolvedEscolaId = await resolveEscolaIdForUser(
    supabase as any,
    user.id,
    escolaParam,
    metaEscolaId ? String(metaEscolaId) : null
  );

  if (!resolvedEscolaId) return <SecretariaDashboardPage />;

  const { data: vinculo } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", resolvedEscolaId)
    .eq("user_id", user.id)
    .maybeSingle();

  const papel = (vinculo?.papel ?? null) as string | null;

  const normalizedPapel = String(papel ?? "").trim().toLowerCase();
  if (normalizedPapel && normalizedPapel !== "secretaria" && normalizedPapel !== "secretaria_financeiro") {
    const qp = new URLSearchParams(sp as Record<string, string> | undefined);
    const query = qp.toString();
    const dest = getDefaultK12PortalPathForRole(normalizedPapel, escolaParam);
    redirect(`${dest}${query ? `?${query}` : ""}`);
  }

  return <SecretariaDashboardPage />;
}
