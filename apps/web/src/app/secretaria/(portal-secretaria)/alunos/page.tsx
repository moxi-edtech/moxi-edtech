import { redirect } from "next/navigation";
import AuditPageView from "@/components/audit/AuditPageView";
import AlunosSecretariaPage from "@/components/secretaria/AlunosSecretariaPage";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
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
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="alunos_list" />
      <DashboardHeader
        title="Alunos"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Alunos" },
        ]}
      />
      <AlunosSecretariaPage />
    </div>
  );
}
