"use client";

import { Calendar, GraduationCap, Zap, ShieldCheck, Clock, Activity } from "lucide-react";

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

export function EstadoVitalBanner({ estado }: { estado: EstadoVital | null }) {
  if (!estado) return null;

  const isExames = estado.fase_operacional === 'EXAMES';
  const isBloqueado = estado.hoje_bloqueado_pedagogico;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-slate-50 px-5 py-2.5 border-b border-slate-200">
        <Activity className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cockpit de Gestão Académica</span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
        
        {/* Metric 1: Session */}
        <div className="p-4 px-6 flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ano Letivo</span>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-slate-100 text-slate-600">
                <Calendar className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-bold text-slate-900">{estado.ano_ativo || '—'}</span>
          </div>
        </div>

        {/* Metric 2: Period */}
        <div className="p-4 px-6 flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Período Vigente</span>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-blue-50 text-blue-600">
                <Clock className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-bold text-slate-900">
                {estado.periodo_tipo ? `${estado.periodo_tipo} ${estado.periodo_numero || ''}` : 'Intervalo'}
            </span>
          </div>
        </div>

        {/* Metric 3: Phase */}
        <div className="p-4 px-6 flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fase Operacional</span>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${isExames ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {isExames ? <GraduationCap className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
            </div>
            <span className={`text-sm font-bold ${isExames ? 'text-amber-700' : 'text-emerald-700'}`}>
                {isBloqueado ? 'Interrupção' : isExames ? 'Avaliações' : 'Aulas Regulares'}
            </span>
          </div>
        </div>

        {/* Metric 4: Writing Status */}
        <div className="p-4 px-6 flex flex-col gap-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status do Diário</span>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${isBloqueado ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {isBloqueado ? <ShieldCheck className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
            </div>
            <span className={`text-sm font-bold ${isBloqueado ? 'text-rose-700' : 'text-emerald-700'}`}>
                {isBloqueado ? 'Lançamentos Travados' : 'Escrita Liberada'}
            </span>
          </div>
        </div>

      </div>

      {/* Status Detail Bar (Only if event is active) */}
      {estado.evento_hoje_nome && (
          <div className={`px-5 py-2 text-[10px] font-semibold border-t flex items-center gap-2 ${isBloqueado ? 'bg-rose-50/50 text-rose-600 border-rose-100' : 'bg-amber-50/50 text-amber-600 border-amber-100'}`}>
              <Info className="h-3 w-3" />
              <span>Evento Ativo: {estado.evento_hoje_nome}</span>
          </div>
      )}
    </div>
  );
}

function Info({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
    );
}



