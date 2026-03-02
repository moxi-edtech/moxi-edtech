import SecretariaDashboardPage from "@/app/secretaria/(portal-secretaria)/page";
import FinanceiroDashboardPage from "@/app/financeiro/page";
import KlasseSecretariaUnificada from "@/components/secretaria/KlasseSecretariaUnificada";
import { supabaseServer } from "@/lib/supabaseServer";

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
    return (
      <KlasseSecretariaUnificada
        balcaoContent={<SecretariaDashboardPage />}
        financeiroContent={<FinanceiroDashboardPage searchParams={Promise.resolve(sp ?? {})} />}
      />
    );
  }

  if (papel === "financeiro") {
    return <FinanceiroDashboardPage searchParams={Promise.resolve(sp ?? {})} />;
  }

  return <SecretariaDashboardPage />;
}
