"use client";

import Link from "next/link";
import { CalendarDays, ArrowRight, CalendarX } from "lucide-react";

export type Evento = {
  id: string;
  titulo: string;
  dataISO: string; // ex: 2025-01-15T08:00:00Z
};

type Props = {
  escolaId?: string;
  events?: Evento[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

export default function EventsSection({ escolaId, events = [] }: Props) {
  const hrefAll = escolaId ? `/escola/${escolaId}/admin/eventos` : "#";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <header className="mb-5 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-900">Próximos eventos</h3>
            <p className="truncate text-xs text-slate-500">Calendário académico e atividades</p>
          </div>
        </div>

        <Link
          href={hrefAll}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-klasse-green-500 hover:bg-emerald-50"
        >
          Ver tudo <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Body */}
      {events.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-600">
          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
            <CalendarX className="h-5 w-5 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">
              Sem eventos agendados
            </p>
            <p className="text-xs text-slate-500 truncate">
              Os próximos eventos aparecerão aqui.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {events.slice(0, 5).map((ev) => {
            const date = formatDate(ev.dataISO);
            const href = escolaId
              ? `/escola/${escolaId}/admin/eventos/${ev.id}`
              : "#";

            return (
              <li key={ev.id}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-xl px-1 py-3 transition hover:bg-slate-50"
                >
                  {/* Data */}
                  <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-slate-700 leading-none">
                    <span className="text-[10px] font-bold uppercase">
                      {date.split(" ")[1]}
                    </span>
                    <span className="text-sm font-black">
                      {date.split(" ")[0]}
                    </span>
                  </div>

                  {/* Título */}
                  <div className="min-w-0 flex-1">
                    {/* 1 linha só */}
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {ev.titulo}
                    </p>
                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-500 group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
