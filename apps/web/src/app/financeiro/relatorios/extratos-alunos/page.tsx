import { supabaseServer } from "@/lib/supabaseServer";
import Link from "next/link";

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string }

export default async function Page(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = (await props.searchParams) ?? ({} as SearchParams)
  const q = (searchParams.q || '').trim()

  const s = await supabaseServer()
  const { data: prof } = await s.from('profiles').select('escola_id').order('created_at', { ascending: false }).limit(1)
  const escolaId = prof?.[0]?.escola_id as string | null

  let alunos: { id: string; nome: string | null; bi_numero: string | null; responsavel: string | null; telefone_responsavel: string | null }[] = []
  if (escolaId) {
    let query = s
      .from('alunos')
      .select('id, nome, bi_numero, responsavel, telefone_responsavel')
      .eq('escola_id', escolaId)
      .order('nome', { ascending: true })
      .limit(50)

    if (q) query = query.ilike('nome', `%${q}%`)

    const { data } = await query
    alunos = (data ?? []) as any
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy">Extratos de Alunos</h1>
          <p className="text-sm text-gray-600">Busque um aluno e gere o extrato (JSON ou PDF)</p>
        </div>
        <form action="" className="flex gap-2 text-sm">
          <input type="text" name="q" defaultValue={q} placeholder="Buscar por nome" className="border rounded px-2 py-1" />
          <button className="px-3 py-1.5 rounded bg-blue-600 text-white">Buscar</button>
        </form>
      </div>

      {!escolaId && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para consultar extratos.
        </div>
      )}

      {escolaId && (
        <div className="bg-white rounded-xl shadow border p-4 overflow-x-auto">
          <table className="min-w-full text-sm align-middle">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Nome</th>
                <th className="py-2 pr-4">BI</th>
                <th className="py-2 pr-4">Responsável</th>
                <th className="py-2 pr-4">Telefone</th>
                <th className="py-2 pr-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {alunos.map((a) => (
                <tr key={a.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">{a.nome ?? '—'}</td>
                  <td className="py-2 pr-4">{a.bi_numero ?? '—'}</td>
                  <td className="py-2 pr-4">{a.responsavel ?? '—'}</td>
                  <td className="py-2 pr-4">{a.telefone_responsavel ?? '—'}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <Link href={`/api/financeiro/extrato/aluno/${a.id}`} className="text-blue-600 hover:underline mr-3" target="_blank">Extrato (JSON)</Link>
                    <Link href={`/api/financeiro/extrato/aluno/${a.id}/pdf`} className="text-blue-600 hover:underline" target="_blank">PDF</Link>
                  </td>
                </tr>
              ))}
              {alunos.length === 0 && (
                <tr><td className="py-6 text-center text-gray-500" colSpan={5}>Nenhum aluno encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

