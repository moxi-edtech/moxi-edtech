// apps/web/src/components/super-admin/ActivitiesSection.tsx
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
    <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Atividade Recente</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">O que aconteceu nas últimas horas</p>
        </div>
        <div className="h-2 w-2 rounded-full bg-[#1F6B3B]" />
      </div>

      <div className="space-y-1">
        {activities.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-300 text-[11px] font-bold uppercase tracking-widest">Sem atividades registadas hoje</p>
          </div>
        ) : (
          activities.map((act, i) => (
            <div key={act.id} className="group flex items-start justify-between gap-6 p-4 rounded-2xl hover:bg-slate-50 transition-all duration-300">
              <div className="flex gap-4">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-200 group-hover:bg-[#1F6B3B] transition-colors" />
                <div>
                  <p className="text-sm font-bold text-slate-900 tracking-tight mb-0.5">{act.titulo}</p>
                  <p className="text-xs font-medium text-slate-500 leading-snug">{act.resumo}</p>
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[10px] font-bold text-slate-300 uppercase tabular-nums">{formatTime(act.data)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      {activities.length > 0 && (
        <button className="w-full mt-6 py-3 rounded-xl border border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
          Ver histórico completo
        </button>
      )}
    </section>
  )
}
