import { supabaseServer } from "@/lib/supabaseServer";
import { ExtratoActions } from "@/components/financeiro/ExtratoActions";

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = { q?: string }

export default async function Page({
  params,
  searchParams: sParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id: escolaId } = await params;
  const searchParams = (await sParams) ?? ({} as SearchParams)
  const q = (searchParams.q || '').trim()
  const s = await supabaseServer()

  let alunos: { id: string; nome: string | null; bi_numero: string | null; responsavel: string | null; telefone_responsavel: string | null }[] = []
  
  let query = s
    .from('alunos')
    .select('id, nome, bi_numero, responsavel, telefone_responsavel')
    .eq('escola_id', escolaId)
    .order('nome', { ascending: true })
    .limit(50)

  if (q) query = query.ilike('nome', `%${q}%`)

  const { data } = await query
  alunos = (data ?? []) as any

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Extratos de Alunos</h1>
          <p className="text-sm text-gray-600">Busque um aluno e gere o extrato (JSON ou PDF)</p>
        </div>
        <form action="" className="flex gap-2 text-sm">
          <input type="text" name="q" defaultValue={q} placeholder="Buscar por nome" className="border rounded px-2 py-1" />
          <button className="px-3 py-1.5 rounded bg-slate-600 text-white">Buscar</button>
        </form>
      </div>

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
                <td className="py-2 pr-4">
                  <ExtratoActions alunoId={a.id} />
                </td>
              </tr>
            ))}
            {alunos.length === 0 && (
              <tr><td className="py-6 text-center text-gray-500" colSpan={5}>Nenhum aluno encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
