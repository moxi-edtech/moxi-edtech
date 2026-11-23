import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import Link from "next/link";

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = { q?: string; days?: string }

export default async function Page({
  params,
  searchParams: sParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id: escolaParam } = await params;
  const searchParams = (await sParams) ?? ({} as SearchParams)
  const s = await supabaseServer()
  const {
    data: { user },
  } = await s.auth.getUser()
  const escolaId = user ? await resolveEscolaIdForUser(s, user.id, escolaParam) : null

  const q = searchParams.q || ''
  const days = searchParams.days || '30'

  const since = (() => {
    const d = parseInt(days || '30', 10)
    if (!Number.isFinite(d) || d <= 0) return '1970-01-01'
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    return dt.toISOString()
  })()

  let logs: Array<Database['public']['Tables']['audit_logs']['Row']> = []
  if (escolaId) {
    let query = s
      .from('audit_logs')
      .select('id, created_at, action, entity, entity_id, details')
      .eq('escola_id', escolaId)
      .eq('portal', 'financeiro')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50)

    if (q) query = query.or(`action.ilike.%${q}%,entity.ilike.%${q}%`)

    const { data } = await query
    logs = (data ?? []) as Array<Database['public']['Tables']['audit_logs']['Row']>
  }

  return (
    <>
      <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="relatorios_detalhados" />
      <div className={PORTAL_PAGE_INSET}>
      <div className="bg-card rounded-xl shadow border p-5">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-lg font-semibold">Relatórios Detalhados</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Período:</span>
              {['1', '7', '30', '90'].map((d) => (
                <Link
                  key={d}
                  href={`/escola/${escolaParam}/financeiro/relatorios/detalhados?days=${encodeURIComponent(d)}&q=${encodeURIComponent(q)}`}
                  className={`px-2.5 py-1 rounded border ${
                    days === d
                      ? 'bg-klasse-gold text-klasse-gold-900 border-klasse-gold'
                      : 'bg-card text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {d === '1' ? '1 dia' : `${d} dias`}
                </Link>
              ))}
              <span className="mx-2 h-4 w-px bg-muted-foreground/15" />
              <span className="text-muted-foreground">Total:</span>
              <span className="text-foreground">{logs.length}</span>
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
            <button className="px-3 py-1.5 rounded-xl bg-klasse-gold text-klasse-gold-900 hover:brightness-95">Filtrar</button>
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
                  {l.created_at ? new Date(l.created_at).toLocaleString() : '—'}
                </td>
                <td className="py-2 pr-4">{l.action}</td>
                <td className="py-2 pr-4">{l.entity}</td>
                <td className="py-2 pr-4">{l.entity_id ?? '—'}</td>
                <td className="py-2 pr-4 max-w-[360px]">
                  <pre className="text-xs text-muted-foreground overflow-auto">{JSON.stringify(l.details || {}, null, 2)}</pre>
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
      </div>
    </>
  )
}
