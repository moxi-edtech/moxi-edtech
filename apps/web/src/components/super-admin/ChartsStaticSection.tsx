// apps/web/src/components/super-admin/ChartsStaticSection.tsx
// Server Component: render aggregated charts data without client JS
import type { ChartsData } from "@/lib/charts"

type Props = {
  data: ChartsData
}

export default function ChartsStaticSection({ data }: Props) {
  const pagamentosList = data.pagamentos.map((p) => ({
    label: p.status ?? 'desconhecido',
    value: Number(p.total ?? 0),
  }))

  return (
    <section className="grid md:grid-cols-2 gap-6 mb-6">
      <div className="bg-white p-6 rounded-2xl shadow border border-moxinexa-light/40">
        <h2 className="text-lg font-semibold mb-4 text-moxinexa-dark">Pagamentos por status</h2>
        {pagamentosList.length ? (
          <ul className="text-sm space-y-2">
            {pagamentosList.map((p, i) => (
              <li key={i} className="flex justify-between"><span>{p.label}</span><span className="font-medium">{p.value}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Sem dados de pagamentos</p>
        )}
      </div>
    </section>
  )
}
