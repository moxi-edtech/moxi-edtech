import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { CarreiraHubClient } from "@/components/aluno/CarreiraHubClient";

export const dynamic = "force-dynamic";

export default async function AlunoCarreiraPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");
  if (auth.role !== "formando") redirect("/dashboard");

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <header className="pt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">portal do formando</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Carreira</h1>
        <p className="mt-2 text-sm text-slate-600">Gerir o teu perfil anonimo e responder a pedidos de entrevista.</p>
      </header>

      <CarreiraHubClient />
    </div>
  );
}
