import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AcessoPortalManager } from "@/components/secretaria/AcessoPortalManager";
import { MetricasAcessoAlunos } from "@/components/secretaria/MetricasAcessoAlunos";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default async function AcessoAlunosPage() {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return redirect("/redirect");

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
  if (!escolaId) return redirect("/redirect");

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <DashboardHeader
            title="Gestão de Acessos ao Portal"
            description="Gerencie o ciclo de vida dos alunos (Pendentes, Ativos e Bloqueados)."
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Secretaria", href: "/secretaria" },
              { label: "Acesso Alunos" },
            ]}
          />
        </div>
      </header>

      <MetricasAcessoAlunos escolaId={escolaId} />

      <AcessoPortalManager escolaId={escolaId} />
    </div>
  );
}
