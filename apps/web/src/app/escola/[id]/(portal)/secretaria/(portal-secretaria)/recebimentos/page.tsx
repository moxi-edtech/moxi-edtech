import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { FilaValidacaoPagamentos } from "@/components/financeiro/FilaValidacaoPagamentos";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RecebimentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  const supabase = await supabaseServer();
  const { data: session } = await supabase.auth.getUser();
  const user = session?.user;

  if (!user) {
    redirect("/redirect");
  }

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
  if (!resolvedEscolaId) {
    redirect("/redirect");
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Janela de Recebimentos"
        description="Validação de comprovantes enviados pelos alunos via fluxo auditável."
        breadcrumbs={[
          { label: "Início", href: `/escola/${escolaId}` },
          { label: "Secretaria", href: `/escola/${escolaId}/secretaria` },
          { label: "Recebimentos" },
        ]}
      />

      <FilaValidacaoPagamentos escolaId={resolvedEscolaId} />
    </div>
  );
}
