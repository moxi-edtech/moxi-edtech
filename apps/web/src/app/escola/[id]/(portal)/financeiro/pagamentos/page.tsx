import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PagamentosListClient } from "@/components/financeiro/PagamentosListClient";
import { FilaValidacaoPagamentos } from "@/components/financeiro/FilaValidacaoPagamentos";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; days?: string };

export default async function Page(props: { 
  params: Promise<{ id: string }>,
  searchParams?: Promise<SearchParams> 
}) {
  const { id: escolaParam } = await props.params;
  const searchParams = (await props.searchParams) ?? ({} as SearchParams);
  const q = searchParams.q || "";
  const days = searchParams.days || "30";
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const escolaId = user ? await resolveEscolaIdForUser(supabase, user.id, escolaParam) : null;

  return (
    <div className="space-y-8">
      <DashboardHeader
        title="Pagamentos"
        description="Consulte os recebimentos confirmados e reverta registos feitos por engano."
        breadcrumbs={[
          { label: "Início", href: `/escola/${escolaParam}` },
          { label: "Financeiro", href: `/escola/${escolaParam}/financeiro` },
          { label: "Pagamentos" },
        ]}
      />

      {/* Fila de Validação (Apenas aparece se houver pendentes) */}
      <section>
        {escolaId ? <FilaValidacaoPagamentos escolaId={escolaId} /> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mostrar pagamentos dos últimos
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {["1", "7", "30", "90"].map((d) => (
                <Link
                  key={d}
                  href={`/escola/${escolaParam}/financeiro/pagamentos?days=${encodeURIComponent(d)}&q=${encodeURIComponent(q)}`}
                  className={`rounded-lg border px-3 py-2 font-semibold transition ${
                    days === d
                      ? "border-klasse-green-600 bg-klasse-green-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-klasse-green-200 hover:text-klasse-green-700"
                  }`}
                >
                  {d === "1" ? "1 dia" : `${d} dias`}
                </Link>
              ))}
            </div>
          </div>

          <form action="" className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
            <input
              type="text"
              name="q"
              placeholder="Pesquisar por método ou referência…"
              defaultValue={q}
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
            />
            <input type="hidden" name="days" value={days} />
            <button className="h-10 rounded-lg bg-klasse-green-600 px-5 text-sm font-semibold text-white hover:bg-klasse-green-700">
              Pesquisar
            </button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Histórico de recebimentos</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Exportar:</span>
            <Link
              href={`/escola/${escolaParam}/financeiro/pagamentos/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
              target="_blank"
              rel="noreferrer"
            >
              Excel/CSV
            </Link>
            <Link
              href={`/escola/${escolaParam}/financeiro/pagamentos/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
              target="_blank"
              rel="noreferrer"
            >
              JSON
            </Link>
          </div>
        </div>

        <div className="mt-4">
          {escolaId ? <PagamentosListClient escolaId={escolaId} /> : null}
        </div>
      </section>
    </div>
  );
}
