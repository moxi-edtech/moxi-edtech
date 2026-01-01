import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/escola/disciplinas";
import { LiberarAcessoAlunos } from "@/components/secretaria/LiberarAcessoAlunos";
import { MetricasAcessoAlunos } from "@/components/secretaria/MetricasAcessoAlunos";

export default async function AcessoAlunosPage() {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return redirect("/conta/login");

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
  if (!escolaId) return redirect("/secretaria");

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-teal-700 uppercase">Portal Secretaria</p>
          <h1 className="text-2xl font-bold text-slate-900">Liberação de acesso de alunos</h1>
          <p className="text-sm text-slate-600">Gere credenciais e envie códigos de ativação em lote.</p>
        </div>
      </header>

      <MetricasAcessoAlunos escolaId={escolaId} />

      <LiberarAcessoAlunos escolaId={escolaId} />
    </div>
  );
}
