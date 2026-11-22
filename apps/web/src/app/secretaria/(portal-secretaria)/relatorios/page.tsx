import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import { supabaseServer } from "@/lib/supabaseServer";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; days?: string };

export default async function Page(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = (await props.searchParams) ?? ({} as SearchParams);
  const s = await supabaseServer();
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  const escolaId = user ? await resolveEscolaIdForUser(s, user.id) : null;

  const q = searchParams.q || "";
  const days = searchParams.days || "30";

  if (!escolaId) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="relatorios" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para ver relatórios.
        </div>
      </>
    );
  }

  const since = (() => {
    const d = parseInt(days || "30", 10);
    if (!Number.isFinite(d) || d <= 0) return "1970-01-01";
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    return dt.toISOString();
  })();

  let query = s
    .from("audit_logs")
    .select("id, created_at, action, entity, entity_id, details")
    .eq("escola_id", escolaId)
    .eq("portal", "secretaria")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) query = query.or(`action.ilike.%${q}%,entity.ilike.%${q}%`);

  const { data } = await query;
  const logs = (data ?? []) as Array<Database["public"]["Tables"]["audit_logs"]["Row"]>;

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="relatorios" />
      <div className={`${PORTAL_PAGE_INSET} space-y-4 rounded-xl border border-border bg-card shadow-sm`}>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <DashboardHeader
              title="Relatórios da Secretaria"
              breadcrumbs={[
                { label: "Início", href: "/" },
                { label: "Secretaria", href: "/secretaria" },
                { label: "Relatórios" },
              ]}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Período:</span>
              {["1", "7", "30", "90"].map((d) => (
                <a
                  key={d}
                  href={`/secretaria/relatorios?days=${encodeURIComponent(d)}&q=${encodeURIComponent(q)}`}
                  className={`px-2.5 py-1 rounded border ${
                    days === d
                      ? "bg-slate-600 text-white border-slate-600"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {d === "1" ? "1 dia" : `${d} dias`}
                </a>
              ))}
              <span className="mx-2 h-4 w-px bg-muted-foreground/15" />
              <a
                href={`/secretaria/relatorios/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`}
                className="px-2.5 py-1 rounded border bg-card text-foreground hover:bg-muted"
                target="_blank"
                rel="noreferrer"
              >
                Exportar CSV
              </a>
              <a
                href={`/secretaria/relatorios/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`}
                className="px-2.5 py-1 rounded border bg-card text-foreground hover:bg-muted"
                target="_blank"
                rel="noreferrer"
              >
                Exportar JSON
              </a>
              <a
                href={`/escola/${escolaId}/secretaria/relatorios/mapa-aproveitamento`}
                className="px-2.5 py-1 rounded-xl border border-border bg-card text-foreground hover:text-amber"
              >
                Abrir Mapa de Aproveitamento
              </a>
              <a
                href={`/escola/${escolaId}/secretaria/relatorios/mensal-escolar`}
                className="px-2.5 py-1 rounded-xl border border-blue-200 bg-blue-50/30 text-blue-700 hover:text-blue-900 font-semibold"
              >
                Relatório Mensal Escolar
              </a>
              <a
                href={`/escola/${escolaId}/secretaria/relatorios/propinas`}
                className="px-2.5 py-1 rounded-xl border border-border bg-card text-foreground hover:text-amber"
              >
                Abrir Relatório de Propinas
              </a>
              <a
                href={`/escola/${escolaId}/secretaria/ponto-professores`}
                className="px-2.5 py-1 rounded-xl border border-emerald-200 bg-emerald-50/30 text-emerald-700 hover:text-emerald-900 font-semibold"
              >
                Ponto dos Professores
              </a>
            </div>
          </div>
          <form action="" className="flex gap-2 text-sm">
            <input
              type="text"
              name="q"
              placeholder="Buscar ação/entidade"
              defaultValue={q}
              className="border rounded px-2 py-1"
            />
            <input type="hidden" name="days" value={days} />
            <button className="px-3 py-1.5 rounded bg-slate-600 text-white">Filtrar</button>
          </form>
        </div>

        <div className="w-full overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-2 pr-4">Quando</th>
              <th className="py-2 pr-4">Ação</th>
              <th className="py-2 pr-4">Entidade</th>
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b last:border-b-0">
                <td className="py-2 pr-4 whitespace-nowrap">
                  {l.created_at ? new Date(l.created_at).toLocaleString() : "—"}
                </td>
                <td className="py-2 pr-4">{l.action}</td>
                <td className="py-2 pr-4">{l.entity}</td>
                <td className="py-2 pr-4">{l.entity_id ?? "—"}</td>
                <td className="py-2 pr-4 max-w-[360px]">
                  <pre className="text-xs text-muted-foreground overflow-auto">
                    {JSON.stringify(l.details || {}, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  Sem eventos neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
