import SecretariaDashboardPage from "@/app/secretaria/(portal-secretaria)/page";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDefaultK12PortalPathForRole } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function SecretariaLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ aluno?: string; view?: string; modo?: string }>;
}) {
  const { id: escolaId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <SecretariaDashboardPage />;

  const { data: vinculo } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", escolaId)
    .eq("user_id", user.id)
    .maybeSingle();

  const papel = (vinculo?.papel ?? null) as string | null;

  const normalizedPapel = String(papel ?? "").trim().toLowerCase();
  if (normalizedPapel && normalizedPapel !== "secretaria" && normalizedPapel !== "secretaria_financeiro") {
    const qp = new URLSearchParams(sp as Record<string, string> | undefined);
    const query = qp.toString();
    const dest = getDefaultK12PortalPathForRole(normalizedPapel, escolaId);
    redirect(`${dest}${query ? `?${query}` : ""}`);
  }

  return <SecretariaDashboardPage />;
}
