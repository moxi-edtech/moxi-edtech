import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { PagamentosListClient } from "@/components/financeiro/PagamentosListClient";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; days?: string };

export default async function Page(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = (await props.searchParams) ?? ({} as SearchParams);
  const q = searchParams.q || "";
  const days = searchParams.days || "30";

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Pagamentos"
        description="Histórico e acompanhamento das transações"
        breadcrumbs={[
          { label: "Financeiro", href: "/financeiro" },
          { label: "Pagamentos" },
        ]}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Período</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {["1", "7", "30", "90"].map((d) => (
                <Link
                  key={d}
                  href={`/financeiro/pagamentos?days=${encodeURIComponent(d)}&q=${encodeURIComponent(q)}`}
                  className={`rounded-full border px-3 py-1.5 font-semibold transition ${
                    days === d
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:text-emerald-700"
                  }`}
                >
                  {d === "1" ? "1 dia" : `${d} dias`}
                </Link>
              ))}
              <span className="mx-2 h-4 w-px bg-slate-200" />
              <Link
                href={`/financeiro/pagamentos/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-700"
                target="_blank"
                rel="noreferrer"
              >
                Exportar CSV
              </Link>
              <Link
                href={`/financeiro/pagamentos/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-700"
                target="_blank"
                rel="noreferrer"
              >
                Exportar JSON
              </Link>
            </div>
          </div>

          <form action="" className="flex flex-wrap gap-2 text-sm">
            <input
              type="text"
              name="q"
              placeholder="Buscar (status/método/ref/UUID)"
              defaultValue={q}
              className="min-w-[220px] rounded-lg border border-slate-200 px-3 py-2"
            />
            <input type="hidden" name="days" value={days} />
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-white">Filtrar</button>
          </form>
        </div>

        <div className="mt-6">
          <PagamentosListClient />
        </div>
      </section>
    </div>
  );
}
