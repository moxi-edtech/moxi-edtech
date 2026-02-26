"use client";

import Link from "next/link";
import { Megaphone, ArrowRight, BellOff } from "lucide-react";

export type Aviso = {
  id: string;
  titulo: string;
  dataISO: string; // ex: "2025-12-25T12:00:00Z"
};

type Props = {
  escolaId?: string;
  notices?: Aviso[];
};

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // pt-BR ok; se preferir pt-AO, dá pra ajustar depois
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
}

export default function NoticesSection({ escolaId, notices = [] }: Props) {
  const hrefAll = escolaId ? `/escola/${escolaId}/admin/avisos` : "#";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <header className="mb-5 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-900">Avisos recentes</h3>
            <p className="truncate text-xs text-slate-500">Comunicados e mensagens para a comunidade</p>
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
      {notices.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-600">
          <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
            <BellOff className="h-5 w-5 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">Sem avisos</p>
            <p className="text-xs text-slate-500 truncate">
              Quando houver comunicados, eles vão aparecer aqui.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {notices.slice(0, 5).map((n) => {
            const date = formatDateShort(n.dataISO);
            const href = escolaId
              ? `/escola/${escolaId}/admin/avisos/${n.id}`
              : "#";

            return (
              <li key={n.id}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-xl px-1 py-3 transition hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Megaphone className="h-4.5 w-4.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* 1 linha só */}
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {n.titulo}
                    </p>
                    <p className="text-xs text-slate-500">{date}</p>
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
