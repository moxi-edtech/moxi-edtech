"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, User, Calendar, FileCheck, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
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

type AvaliacaoItem = {
  id: string;
  disciplina: string;
  tipo: string; // Ex: "Prova MAC", "Prova NPP", "Trabalho de Investigação"
  data: string;
  dias_restantes: number;
  sala?: string;
};

const DIAS_SEMANA = [
  { id: 1, nome: "Segunda" },
  { id: 2, nome: "Terça" },
  { id: 3, nome: "Quarta" },
  { id: 4, nome: "Quinta" },
  { id: 5, nome: "Sexta" },
];

export function TabHorario() {
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("aluno");

  const [data, setData] = useState<TimetableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<number>(new Date().getDay() || 1);
  const [activeTab, setActiveTab] = useState<"horario" | "agenda">("horario");

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);

    const url = studentId 
      ? `/api/aluno/horario?studentId=${studentId}`
      : "/api/aluno/horario";

    fetch(url, { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json() as Promise<TimetableData>)
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [studentId]);

  const slotsPorDia = useMemo(() => {
    if (!data?.slots) return [];
    return data.slots.filter((s) => s.dia_semana === activeDay);
  }, [data, activeDay]);

  const getAssignment = (slotId: string) => {
    return data?.assignments.find((a) => a.slot_id === slotId);
  };

  // Avaliações de exemplo (SSOT integrado com disciplinas do aluno)
  const avaliacoesMock: AvaliacaoItem[] = useMemo(() => {
    const disciplinas = Array.from(new Set(data?.assignments.map((a) => a.disciplina) ?? []));
    if (disciplinas.length === 0) {
      return [
        { id: "1", disciplina: "Matemática", tipo: "Prova NPP (2º Trimestre)", data: "2026-08-14", dias_restantes: 3, sala: "Sala 04" },
        { id: "2", disciplina: "Física", tipo: "Avaliação Contínua (MAC)", data: "2026-08-18", dias_restantes: 7, sala: "Laboratório 1" },
        { id: "3", disciplina: "Língua Portuguesa", tipo: "Entrega de Redação", data: "2026-08-22", dias_restantes: 11 },
      ];
    }
    return [
      { id: "1", disciplina: disciplinas[0] || "Matemática", tipo: "Prova NPP (2º Trimestre)", data: "2026-08-14", dias_restantes: 3, sala: "Sala 04" },
      { id: "2", disciplina: disciplinas[1] || "Física", tipo: "Avaliação Contínua (MAC)", data: "2026-08-18", dias_restantes: 7, sala: "Laboratório 1" },
      { id: "3", disciplina: disciplinas[2] || "Química", tipo: "Trabalho Individual", data: "2026-08-22", dias_restantes: 11 },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionTitle>Horário & Agenda</SectionTitle>
        <TableSkeleton rows={5} cols={1} />
      </div>
    );
  }

  if (!data?.version) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
          <Calendar className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900">Horário não publicado</h3>
          <p className="text-xs text-slate-500 max-w-xs">
            O horário oficial para a sua turma ainda não foi publicado pela coordenação pedagógica.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-1 px-1">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Horário & Agenda</h2>
        <p className="text-xs font-medium text-slate-500">Programação de aulas, salas e datas de testes.</p>
      </header>

      {/* Switcher Sóbrio de Modos */}
      <div className="flex w-full rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("horario")}
          className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "horario"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Grade de Aulas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("agenda")}
          className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "agenda"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Agenda de Provas ({avaliacoesMock.length})
        </button>
      </div>

      {/* MODO 1: Grade de Aulas Semanal */}
      {activeTab === "horario" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Selector de Dias */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {DIAS_SEMANA.map((dia) => (
              <button
                key={dia.id}
                onClick={() => setActiveDay(dia.id)}
                className={`flex-shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeDay === dia.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-100 hover:bg-slate-50"
                }`}
              >
                {dia.nome}
              </button>
            ))}
          </div>

          {/* Lista de Aulas */}
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
                    <div className="bg-slate-50 px-3 py-0.5 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Intervalo
                    </div>
                    <div className="flex-grow border-t border-dashed border-slate-200" />
                  </div>
                );
              }

              return (
                <AlunoCard key={slot.id} className="relative overflow-hidden group border border-slate-100/80 bg-white p-4 rounded-2xl">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 pt-0.5 text-center min-w-[48px]">
                      <div className="text-xs font-black text-slate-900">{slot.inicio}</div>
                      <div className="text-[10px] font-semibold text-slate-400">{slot.fim}</div>
                    </div>

                    <div className="flex-grow min-w-0 space-y-1">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {aula?.disciplina || "Sem aula agendada"}
                      </h4>
                      
                      {aula && (
                        <div className="flex flex-wrap gap-3 pt-0.5">
                          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[140px]">{aula.professor}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                            <MapPin className="h-3 w-3" />
                            <span>{aula.sala}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {aula && (
                      <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-xl bg-slate-50 text-slate-400">
                        <Clock className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </AlunoCard>
              );
            })}

            {slotsPorDia.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                Nenhuma aula agendada para este dia.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODO 2: Agenda de Avaliações (Sóbria e Minimalista) */}
      {activeTab === "agenda" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {avaliacoesMock.map((item) => (
            <AlunoCard key={item.id} className="border border-slate-100/80 bg-white p-4 rounded-2xl space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-700 font-bold">
                    <FileCheck size={18} />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-slate-900">{item.disciplina}</h4>
                    <p className="text-xs font-medium text-slate-500">{item.tipo}</p>
                  </div>
                </div>

                {/* Badge de Contagem Regressiva */}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-700 border border-slate-200/60 shrink-0">
                  {item.dias_restantes === 0 ? "Hoje" : item.dias_restantes === 1 ? "Amanhã" : `Faltam ${item.dias_restantes} dias`}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100">
                <span>Data: {new Date(item.data).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</span>
                {item.sala && <span>Local: {item.sala}</span>}
              </div>
            </AlunoCard>
          ))}
        </div>
      )}

    </div>
  );
}
