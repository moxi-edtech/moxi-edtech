import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function AdminCentroDashboardPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return (
    <div className="grid gap-4">
      <header>
        <p className="m-0 text-xs uppercase tracking-wider text-zinc-500">
          Admin Centro
        </p>
        <h1 className="mt-1.5 text-3xl font-bold text-zinc-900">Dashboard de Gestão</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Onboarding" value="Pendente" subtitle="Finalizar checklist do centro" />
        <Card title="Cursos" value="0" subtitle="Criar catálogo inicial" />
        <Card title="Cohorts" value="0" subtitle="Abrir primeira edição" />
        <Card title="Equipa" value="2+" subtitle="Admin + Secretaria mínimos" />
      </section>

      <section className="rounded-xl border border-zinc-200 p-3.5">
        <h2 className="mt-0 text-lg font-semibold text-zinc-900">Próximas ações</h2>
        <ol className="m-0 list-decimal space-y-2 pl-5 leading-relaxed text-zinc-700">
          <li>Configurar dados fiscais do centro (NIPC, regime IVA, MAPTESS).</li>
          <li>Criar catálogo de cursos e abrir cohorts ativos.</li>
          <li>Convidar formadores e validar acessos por papel.</li>
        </ol>
      </section>
    </div>
  );
}

function Card({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-3">
      <p className="m-0 text-xs text-zinc-500">{title}</p>
      <p className="my-2 text-3xl font-bold text-zinc-900">{value}</p>
      <p className="m-0 text-sm text-zinc-600">{subtitle}</p>
    </article>
  );
}
