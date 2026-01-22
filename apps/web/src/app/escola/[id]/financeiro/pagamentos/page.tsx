import PortalLayout from "@/components/layout/PortalLayout"
import { supabaseServer } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import AuditPageView from "@/components/audit/AuditPageView"
import { PagamentosListClient } from "@/components/financeiro/PagamentosListClient"

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; days?: string }

export default async function Page(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = (await props.searchParams) ?? ({} as SearchParams)
  const s = await supabaseServer()
  const { data: userRes } = await s.auth.getUser()
  const escolaId = userRes?.user ? await resolveEscolaIdForUser(s, userRes.user.id) : null

  const q = searchParams.q || ""
  const days = searchParams.days || "30"

  if (!escolaId) {
    return (
      <PortalLayout>
        <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="pagamentos_list" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para ver pagamentos.
        </div>
      </PortalLayout>
    )
  }

  return (
    <PortalLayout>
      <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="pagamentos_list" />
      <div className="bg-white rounded-xl shadow border p-5">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-lg font-semibold">Pagamentos</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Período:</span>
              {['1','7','30','90'].map((d) => (
                <a key={d} href={`/financeiro/pagamentos?days=${encodeURIComponent(d)}&q=${encodeURIComponent(q)}`} className={`px-2.5 py-1 rounded border ${days === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}>{d === '1' ? '1 dia' : `${d} dias`}</a>
              ))}
              <span className="mx-2 h-4 w-px bg-gray-200" />
              <a href={`/financeiro/pagamentos/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`} className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100" target="_blank" rel="noreferrer">Exportar CSV</a>
              <a href={`/financeiro/pagamentos/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`} className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100" target="_blank" rel="noreferrer">Exportar JSON</a>
            </div>
          </div>
          <form action="" className="flex gap-2 text-sm">
            <input type="text" name="q" placeholder="Buscar (status/método/ref/UUID)" defaultValue={q} className="border rounded px-2 py-1" />
            <input type="hidden" name="days" value={days} />
            <button className="px-3 py-1.5 rounded bg-blue-600 text-white">Filtrar</button>
          </form>
        </div>

        <PagamentosListClient />
      </div>
    </PortalLayout>
  )
}
