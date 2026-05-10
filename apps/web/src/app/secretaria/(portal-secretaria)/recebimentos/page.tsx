import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import PagamentosPendentesWindow from "@/components/secretaria/PagamentosPendentesWindow";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RecebimentosPage() {
  const supabase = await supabaseServer();
  const { data: session } = await supabase.auth.getUser();
  const user = session?.user;

  if (!user) {
    redirect("/redirect");
  }

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) {
    redirect("/redirect");
  }

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Recebimentos"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Recebimentos" },
        ]}
      />
      <PagamentosPendentesWindow />
    </div>
  );
}
