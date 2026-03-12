"use client";

import Link from "next/link";
import { Activity, ArrowRight, AlertTriangle } from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { familyBadgeClasses, familyLabel, toFeedSubline } from "@/lib/admin/activityFeed";
import { useAdminActivityFeed } from "./useAdminActivityFeed";

type Props = {
  escolaId: string;
};

function formatTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "--:--";
  return dt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function OperationalFeedSection({ escolaId }: Props) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const { items, loading, realtimeState } = useAdminActivityFeed(escolaId, 20);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">Feed Operacional</h3>
            <p className="truncate text-xs text-slate-500">Eventos críticos e actividade recente da escola</p>
          </div>
        </div>

        <Link
          href={`/escola/${escolaParam}/admin/relatorios`}
          className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-bold text-[#E3B23C] hover:bg-klasse-gold-50"
        >
          Ver histórico completo <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {realtimeState === "polling" && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-semibold">Ligação instável — atualizando por polling.</span>
        </div>
      )}

      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <li key={idx} className="animate-pulse rounded-xl border border-slate-100 p-3">
              <div className="mb-2 h-3 w-10 rounded bg-slate-100" />
              <div className="mb-2 h-3 w-2/3 rounded bg-slate-100" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
          Sem atividade nas últimas horas.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 8).map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-100 px-3 py-2">
              <div className="flex items-start gap-3">
                <p className="w-10 flex-shrink-0 text-xs font-bold text-slate-700">{formatTime(item.occurred_at)}</p>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.headline}</p>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${familyBadgeClasses(item.event_family)}`}>
                      {familyLabel(item.event_family)}
                    </span>
                  </div>
                  {toFeedSubline(item) && (
                    <p className="truncate text-xs text-slate-500">{toFeedSubline(item)}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
