"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, User, Calendar } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { SectionTitle } from "@/components/aluno/shared/SectionTitle";
import { TableSkeleton } from "@/components/feedback/FeedbackSystem";

type Slot = {
  id: string;
  dia_semana: number;
  ordem: number;
  inicio: string;
  fim: string;
  is_intervalo: boolean;
};

type Assignment = {
  slot_id: string;
  disciplina: string;
  professor: string;
  sala: string;
};

type TimetableData = {
  ok: boolean;
  version: string | null;
  slots: Slot[];
  assignments: Assignment[];
};

const DIAS_SEMANA = [
  { id: 1, nome: "Segunda" },
  { id: 2, nome: "Terça" },
  { id: 3, nome: "Quarta" },
  { id: 4, nome: "Quinta" },
  { id: 5, nome: "Sexta" },
];

export function TabHorario() {
  const [data, setData] = useState<TimetableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<number>(new Date().getDay() || 1); // Default to today or Monday

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/aluno/horario", { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json() as Promise<TimetableData>)
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const slotsPorDia = useMemo(() => {
    if (!data?.slots) return [];
    return data.slots.filter((s) => s.dia_semana === activeDay);
  }, [data, activeDay]);

  const getAssignment = (slotId: string) => {
    return data?.assignments.find((a) => a.slot_id === slotId);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionTitle>Horário das Aulas</SectionTitle>
        <TableSkeleton rows={5} cols={1} />
      </div>
    );
  }

  if (!data?.version) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-slate-100 p-4">
          <Calendar className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-slate-900">Horário não disponível</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-[200px]">
          O horário oficial para sua turma ainda não foi publicado pela coordenação.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <SectionTitle>Horário Semanal</SectionTitle>
        <p className="text-xs text-slate-500">Confira a programação das suas aulas e salas.</p>
      </header>

      {/* Selector de Dias (Mobile) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {DIAS_SEMANA.map((dia) => (
          <button
            key={dia.id}
            onClick={() => setActiveDay(dia.id)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              activeDay === dia.id
                ? "bg-klasse-gold text-slate-900 shadow-sm"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {dia.nome}
          </button>
        ))}
      </div>

      {/* Lista de Aulas do Dia */}
      <div className="space-y-3">
        {slotsPorDia.map((slot) => {
          const aula = getAssignment(slot.id);
          
          if (slot.is_intervalo) {
            return (
              <div key={slot.id} className="relative flex items-center gap-4 py-2">
                <div className="flex-shrink-0 w-12 text-[10px] font-bold text-slate-400 uppercase">
                  {slot.inicio}
                </div>
                <div className="flex-grow border-t border-dashed border-slate-200" />
                <div className="absolute left-1/2 -translate-x-1/2 bg-slate-50 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Intervalo
                </div>
                <div className="flex-grow border-t border-dashed border-slate-200" />
              </div>
            );
          }

          return (
            <AlunoCard key={slot.id} className="relative overflow-hidden group">
              {/* Timeline Indicator */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100 group-hover:bg-klasse-gold transition-colors" />
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-1">
                  <div className="text-xs font-bold text-slate-900">{slot.inicio}</div>
                  <div className="text-[10px] text-slate-400">{slot.fim}</div>
                </div>

                <div className="flex-grow min-w-0 space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {aula?.disciplina || "Sem aula agendada"}
                  </h4>
                  
                  {aula && (
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <User className="h-3 w-3" />
                        <span className="truncate max-w-[120px]">{aula.professor}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <MapPin className="h-3 w-3" />
                        <span>{aula.sala}</span>
                      </div>
                    </div>
                  )}
                </div>

                {aula && (
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-slate-50 text-slate-400">
                    <Clock className="h-4 w-4" />
                  </div>
                )}
              </div>
            </AlunoCard>
          );
        })}

        {slotsPorDia.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-400">
            Nenhuma atividade programada para este dia.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Info className="h-3 w-3" />
          Nota da Coordenação
        </h5>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Os horários podem sofrer alterações conforme necessidade pedagógica. 
          Fique atento às notificações para eventuais mudanças de sala ou professor.
        </p>
      </div>
    </div>
  );
}

function Info({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}
