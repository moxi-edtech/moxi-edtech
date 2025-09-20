import PortalLayout from "@/components/layout/PortalLayout"
import { supabaseServer } from "@/lib/supabaseServer"
import AuditPageView from "@/components/audit/AuditPageView"

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; days?: string }

export default async function Page(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = (await props.searchParams) ?? ({} as SearchParams)
  const s = await supabaseServer()
  const { data: prof } = await s.from('profiles').select('escola_id').order('created_at', { ascending: false }).limit(1)
  const escolaId = prof?.[0]?.escola_id as string | null

  const q = searchParams.q || ''
  const days = searchParams.days || '30'

  const since = (() => {
    const d = parseInt(days || '30', 10)
    if (!Number.isFinite(d) || d <= 0) return '1970-01-01'
    const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString()
  })()

  if (!escolaId) {
    return (
      <PortalLayout>
        <AuditPageView portal="secretaria" action="PAGE_VIEW" entity="alunos_list" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para ver alunos.
        </div>
      </PortalLayout>
    )
  }

  let query = s
    .from('alunos')
    .select('id, nome, email, created_at')
    .eq('escola_id', escolaId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)

  if (q) {
    const uuidRe = /^[0-9a-fA-F-]{36}$/
    if (uuidRe.test(q)) {
      query = query.or(`id.eq.${q}`)
    } else {
      query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%`)
    }
  }

  const { data, error } = await query
  const alunos = (data ?? []) as any[]

  return (
    <PortalLayout>
      <AuditPageView portal="secretaria" action="PAGE_VIEW" entity="alunos_list" />
      <div className="bg-white rounded-xl shadow border p-5">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-lg font-semibold">Alunos</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Período:</span>
              {['1','7','30','90'].map((d) => (
                <a key={d} href={`/secretaria/alunos?days=${encodeURIComponent(d)}&q=${encodeURIComponent(q)}`} className={`px-2.5 py-1 rounded border ${days === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}>{d === '1' ? '1 dia' : `${d} dias`}</a>
              ))}
              <span className="mx-2 h-4 w-px bg-gray-200" />
              <a href={`/secretaria/alunos/export?format=csv&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`} className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100" target="_blank">Exportar CSV</a>
              <a href={`/secretaria/alunos/export?format=json&days=${encodeURIComponent(days)}&q=${encodeURIComponent(q)}`} className="px-2.5 py-1 rounded border bg-white text-gray-700 hover:bg-gray-100" target="_blank">Exportar JSON</a>
            </div>
          </div>
          <form action="" className="flex gap-2 text-sm">
            <input type="text" name="q" placeholder="Buscar (nome/e-mail/UUID)" defaultValue={q} className="border rounded px-2 py-1" />
            <input type="hidden" name="days" value={days} />
            <button className="px-3 py-1.5 rounded bg-blue-600 text-white">Filtrar</button>
          </form>
        </div>

        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Nome</th>
              <th className="py-2 pr-4">E-mail</th>
              <th className="py-2 pr-4">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map((a: any) => (
              <tr key={a.id} className="border-b last:border-b-0">
                <td className="py-2 pr-4">{a.id}</td>
                <td className="py-2 pr-4">{a.nome}</td>
                <td className="py-2 pr-4">{a.email ?? '—'}</td>
                <td className="py-2 pr-4">{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {alunos.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-gray-500">Nenhum aluno encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PortalLayout>
  )
}
