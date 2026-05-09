import SecretariaDashboardPage from "@/app/secretaria/(portal-secretaria)/page";
import { supabaseServer } from "@/lib/supabaseServer";
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

  if (papel === "secretaria_financeiro") {
    return <SecretariaDashboardPage />;
  }

  if (papel === "financeiro") {
    const qp = new URLSearchParams(sp as Record<string, string> | undefined);
    const query = qp.toString();
    redirect(`/escola/${escolaId}/financeiro${query ? `?${query}` : ""}`);
  }

  return <SecretariaDashboardPage />;
}
