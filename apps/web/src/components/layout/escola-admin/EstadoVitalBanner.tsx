"use client";

import { Calendar, Clock, Activity } from "lucide-react";

type EstadoVital = {
  escola_id: string;
  session_id: string | null;
  ano_ativo: number | null;
  periodo_id: string | null;
  periodo_tipo: string | null;
  periodo_numero: number | null;
  hoje_bloqueado_pedagogico: boolean;
  evento_hoje_nome: string | null;
  fase_operacional: 'REGULAR' | 'EXAMES';
};

export function EstadoVitalBanner({ estado, isOperacoes = false }: { estado: EstadoVital | null; isOperacoes?: boolean }) {
  if (!estado) return null;

  const isExames = estado.fase_operacional === 'EXAMES';
  const isBloqueado = estado.hoje_bloqueado_pedagogico;

  return (
    <div className={`border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 ${isOperacoes ? "rounded-lg shadow-none" : "rounded-xl shadow-sm"}`}>
      {/* Lado Esquerdo: Título e Status Resumido */}
      <div className="flex items-center gap-3">
        <div className={`bg-slate-50 p-2 text-slate-500 border border-slate-100 ${isOperacoes ? "rounded-lg" : "rounded-xl"}`}>
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado Académico</p>
          <p className="text-xs font-bold text-slate-700 mt-0.5">
            {estado.evento_hoje_nome ? `Hoje: ${estado.evento_hoje_nome}` : 'Operação regular'}
          </p>
        </div>
      </div>

      {/* Lado Direito: As 4 Métricas em Formato Inline Minimalista */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        {/* Metrica 1 */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-400 font-medium">Ano:</span>
          <span className="font-bold text-slate-800">{estado.ano_ativo || '—'}</span>
        </div>

        {/* Metrica 2 */}
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-400 font-medium">Período:</span>
          <span className="font-bold text-slate-800">
            {estado.periodo_tipo ? `${estado.periodo_tipo} ${estado.periodo_numero || ''}` : 'Intervalo'}
          </span>
        </div>

        {/* Metrica 3 (Fase como Pill suave) */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-medium">Fase:</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
            isExames ? 'bg-amber-50 text-amber-700 border border-amber-100/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'
          }`}>
            {isBloqueado ? 'Interrupção' : isExames ? 'Exames' : 'Aulas'}
          </span>
        </div>

        {/* Metrica 4 (Status Diário como Pill suave) */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-medium">Diário:</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
            isBloqueado ? 'bg-rose-50 text-rose-700 border border-rose-100/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'
          }`}>
            {isBloqueado ? 'Bloqueado' : 'Liberado'}
          </span>
        </div>
      </div>
    </div>
  );
}
