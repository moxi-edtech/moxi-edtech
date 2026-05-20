import RelatorioMensalidadesClient from "@/components/secretaria/RelatorioMensalidadesClient";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MensalEscolarSecretariaPage() {
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
        title="Relatório Mensal Escolar"
        breadcrumbs={[
          { label: "Início", href: `/escola/${escolaId}/secretaria` },
          { label: "Relatórios", href: `/escola/${escolaId}/secretaria/relatorios` },
          { label: "Mensal Escolar" },
        ]}
      />
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <RelatorioMensalidadesClient />
      </div>
    </div>
  );
}
