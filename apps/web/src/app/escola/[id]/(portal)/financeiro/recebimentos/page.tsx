import Link from "next/link";
import { ArrowRight, Clock3, History, Plus } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FilaValidacaoPagamentos } from "@/components/financeiro/FilaValidacaoPagamentos";
import { PagamentosListClient } from "@/components/financeiro/PagamentosListClient";
import { InstantWorkspaceTabs } from "@/components/financeiro/InstantWorkspaceTabs";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  vista?: "validar" | "historico";
  q?: string;
  days?: string;
};

export default async function RecebimentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id: escolaParam } = await params;
  const filters = (await searchParams) ?? {};
  const vista = filters.vista === "historico" ? "historico" : "validar";
  const q = filters.q || "";
  const days = filters.days || "30";
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const escolaId = user
    ? await resolveEscolaIdForUser(supabase, user.id, escolaParam)
    : null;

  return (
    <main className="space-y-6 p-4 md:p-6">
      <DashboardHeader
        title="Recebimentos"
        description="Registe entradas, valide comprovativos e consulte o histórico num único lugar."
        breadcrumbs={[
          { label: "Início", href: `/escola/${escolaParam}` },
          { label: "Financeiro", href: `/escola/${escolaParam}/financeiro` },
          { label: "Recebimentos" },
        ]}
      />

      {!escolaId ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Não foi possível identificar a escola ativa.
        </div>
      ) : (
        <InstantWorkspaceTabs
          initialTab={vista}
          ariaLabel="Vistas de recebimentos"
          actions={
            <Link
              href={`/escola/${escolaParam}/operacoes/financeiro/cobrancas`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-klasse-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-klasse-green-700"
            >
              <Plus className="h-4 w-4" /> Registar recebimento
            </Link>
          }
          tabs={[
            {
              id: "validar",
              label: "Por validar",
              icon: <Clock3 className="h-4 w-4" />,
              content: <FilaValidacaoPagamentos escolaId={escolaId} />,
            },
            {
              id: "historico",
              label: "Histórico",
              icon: <History className="h-4 w-4" />,
              content: (
                <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Mostrar pagamentos dos últimos
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["1", "7", "30", "90"].map((period) => (
                          <Link
                            key={period}
                            href={`?vista=historico&days=${period}&q=${encodeURIComponent(q)}`}
                            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                              days === period
                                ? "border-klasse-green-600 bg-klasse-green-600 text-white"
                                : "border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {period === "1" ? "1 dia" : `${period} dias`}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <form action="" className="flex w-full gap-2 lg:max-w-xl">
                      <input type="hidden" name="vista" value="historico" />
                      <input type="hidden" name="days" value={days} />
                      <input
                        type="search"
                        name="q"
                        defaultValue={q}
                        placeholder="Pesquisar por método ou referência…"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                      />
                      <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">
                        Pesquisar <ArrowRight className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                  <div className="flex justify-end gap-2 text-xs">
                    <span className="self-center text-slate-500">Exportar:</span>
                    <Link
                      href={`/escola/${escolaParam}/financeiro/pagamentos/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`}
                      target="_blank"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600"
                    >
                      Excel/CSV
                    </Link>
                    <Link
                      href={`/escola/${escolaParam}/financeiro/pagamentos/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`}
                      target="_blank"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600"
                    >
                      JSON
                    </Link>
                  </div>
                  <PagamentosListClient escolaId={escolaId} />
                </section>
              ),
            },
          ]}
        />
      )}
    </main>
  );
}
