type Activity = {
  descricao: string
  status: "Ativo" | "Aplicado" | "Pendente"
  cor: string
}

export default function ActivitiesSection({ activities }: { activities: Activity[] }) {
  return (
    <section className="bg-white p-6 rounded-2xl shadow border border-moxinexa-light/50">
      <h2 className="text-lg font-semibold mb-4">Atividades Recentes</h2>
      <ul className="space-y-3 text-sm">
        {activities.length === 0 ? (
          <p className="text-moxinexa-gray text-sm">Nenhuma atividade encontrada</p>
        ) : (
          activities.map((act, i) => (
            <li key={i} className="flex justify-between">
              <span className="text-moxinexa-dark">{act.descricao}</span>
              <span className={`${act.cor} font-medium`}>{act.status}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
