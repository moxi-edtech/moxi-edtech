"use client";

import { Calendar, ArrowRight } from "lucide-react";

type Evento = { id: string; titulo: string; dataISO: string };

export default function EventsSection({ events }: { events?: Evento[] }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-moxinexa-navy flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-500" />
            Próximos Eventos
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe os eventos programados para a escola
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-none-100 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-purple-200 transition-all">
          Ver Todos
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {(!events || events.length === 0) ? (
        <div className="text-center py-8 text-slate-500">
          <Calendar className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <div className="text-sm">Nenhum evento programado</div>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="flex items-center gap-4 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="bg-purple-100 text-purple-600 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 text-sm truncate">{event.titulo}</div>
                <div className="text-xs text-slate-500">
                  {new Date(event.dataISO).toLocaleDateString('pt-BR', { 
                    weekday: 'short', 
                    day: '2-digit', 
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}