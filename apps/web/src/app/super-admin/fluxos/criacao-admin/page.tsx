import Mermaid from "@/components/Mermaid";
import { fluxoCriacaoAdmin } from "@/lib/diagrams";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Fluxo: Criação de Escola e Admin</h1>
        <p className="text-sm text-slate-500">
          Fluxo operacional de provisioning com validações críticas para tenancy e segurança.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <Mermaid chart={fluxoCriacaoAdmin} className="overflow-auto rounded-xl border bg-white p-4" />
      </div>
    </section>
  );
}
