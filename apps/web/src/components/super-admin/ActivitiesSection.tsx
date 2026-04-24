import { Clock3 } from "lucide-react";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "@/components/super-admin/WidgetStates";

type Activity = {
  id: string;
  titulo: string;
  resumo: string;
  data: string;
};

const formatTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });
};

export default function ActivitiesSection({ activities, isLoading = false }: { activities?: Activity[]; isLoading?: boolean }) {
  if (isLoading) return <WidgetSkeleton lines={4} />;

  if (!activities) {
    return (
      <WidgetError
        title="Falha ao carregar atividade recente"
        message="O feed de auditoria não retornou dados nesta sessão."
        nextStep="Valide a tabela `audit_logs` e recarregue o painel de controle."
      />
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Atividade Recente</h2>
          <p className="mt-1 text-sm text-slate-500">Eventos registados nas últimas horas.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
          <Clock3 className="h-4 w-4" />
          Tempo real
        </span>
      </div>

      <div className="space-y-2">
        {activities.length === 0 ? (
          <WidgetEmpty
            title="Sem atividade recente"
            message="Não há eventos relevantes registrados nas últimas horas."
            nextStep="Confirme ingestão de auditoria e execute uma ação de teste supervisionada."
          />
        ) : (
          activities.map((act) => (
            <article
              key={act.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-transparent p-3 transition hover:border-slate-200 hover:ring-1 hover:ring-klasse-gold/25"
            >
              <div>
                <p className="text-sm font-semibold text-slate-950">{act.titulo}</p>
                <p className="text-sm text-slate-500">{act.resumo}</p>
              </div>
              <time className="shrink-0 text-sm font-medium text-slate-500">{formatTime(act.data)}</time>
            </article>
          ))
        )}
      </div>

      {activities.length > 0 && (
        <button className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:ring-1 hover:ring-klasse-gold/25">
          Ver histórico completo
        </button>
      )}
    </section>
  );
}
