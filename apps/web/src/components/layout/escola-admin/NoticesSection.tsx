"use client";

import { MegaphoneIcon } from "@heroicons/react/24/outline";
import { Megaphone, ArrowRight, Bell } from "lucide-react";

type Aviso = { id: string; titulo: string; dataISO: string };

export default function NoticesSection({ notices }: { notices?: Aviso[] }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-moxinexa-navy flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            Avisos Recentes
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Fique por dentro das últimas comunicações
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200 transition-all">
          Ver Todos
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {(!notices || notices.length === 0) ? (
        <div className="text-center py-8 text-slate-500">
          <Megaphone className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <div className="text-sm">Nenhum aviso recente</div>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <div key={notice.id} className="flex items-center gap-4 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="bg-amber-100 text-amber-600 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Megaphone className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 text-sm truncate">{notice.titulo}</div>
                <div className="text-xs text-slate-500">
                  Publicado em {new Date(notice.dataISO).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}