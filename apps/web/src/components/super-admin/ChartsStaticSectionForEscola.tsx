import { supabaseServer } from "@/lib/supabaseServer"

type Props = {
  escolaId: string
}

export default async function ChartsStaticSectionForEscola({ escolaId }: Props) {
  const supabase = await supabaseServer()

  // Views may not exist in all environments; guard errors
  
  const { data: p } = await supabase
    .from('pagamentos_status' as unknown as never)
    .select('status, total')
    .eq('escola_id', escolaId)

  
  const pagamentos = (p as { status: string | null; total: number | null }[] | null) ?? []

  return (
    <section className="grid md:grid-cols-2 gap-6 mb-6">
      <div className="bg-white p-6 rounded-2xl shadow border border-moxinexa-light/50">
        <h2 className="text-lg font-semibold mb-4 text-moxinexa-dark">Matrículas por ano</h2>
       
    
        ) : (
          <p className="text-sm text-gray-500">Sem dados</p>
        )
      </div>
      <div className="bg-white p-6 rounded-2xl shadow border border-moxinexa-light/50">
        <h2 className="text-lg font-semibold mb-4 text-moxinexa-dark">Pagamentos por status</h2>
        {pagamentos.length ? (
          <ul className="text-sm space-y-2">
            {pagamentos.map((r, i) => (
              <li key={i} className="flex justify-between"><span>{r.status ?? 'desconhecido'}</span><span className="font-medium">{Number(r.total ?? 0)}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Sem dados</p>
        )}
      </div>
    </section>
  )
}

