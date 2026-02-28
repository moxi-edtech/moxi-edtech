type Activity = {
  id: string
  titulo: string
  resumo: string
  data: string
}

const formatTime = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })
}

export default function ActivitiesSection({ activities }: { activities: Activity[] }) {
  return (
    <section className="bg-white p-6 rounded-2xl shadow border border-moxinexa-light/40">
      <h2 className="text-lg font-semibold mb-4">Atividades Recentes</h2>
      <ul className="space-y-3 text-sm">
        {activities.length === 0 ? (
          <p className="text-moxinexa-gray text-sm">Nenhuma atividade encontrada</p>
        ) : (
          activities.map((act, i) => (
            <li key={act.id} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-moxinexa-dark">{act.titulo}</p>
                <p className="text-xs text-slate-500">{act.resumo}</p>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">{formatTime(act.data)}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
