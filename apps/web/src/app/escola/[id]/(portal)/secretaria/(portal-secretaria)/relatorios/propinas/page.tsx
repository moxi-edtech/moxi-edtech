import PropinasReportClient from "@/app/escola/[id]/(portal)/financeiro/relatorios/propinas/page";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RelatorioPropinasSecretariaPage() {
  const s = await supabaseServer();
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  const escolaId = user ? await resolveEscolaIdForUser(s, user.id) : null;

  if (!escolaId) {
    redirect("/secretaria/relatorios");
  }

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Relatório de Propinas"
        breadcrumbs={[
          { label: "Início", href: `/escola/${escolaId}/secretaria` },
          { label: "Relatórios", href: `/escola/${escolaId}/secretaria/relatorios` },
          { label: "Propinas" },
        ]}
      />
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <PropinasReportClient />
      </div>
    </div>
  );
}
