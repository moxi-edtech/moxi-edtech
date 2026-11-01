"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, User, Calendar, FileCheck, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
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
  reason?: "NO_ENROLLMENT" | "NO_CLASS" | "NOT_PUBLISHED" | null;
  context?: {
    anoLetivoId: string;
    anoLetivoLabel: string;
    mode: "CURRENT" | "HISTORICAL_READ";
  };
};

type AcademicEvent = {
  id: string;
  nome: string;
  tipo: string;
  data_inicio: string;
  data_fim: string;
};

function formatAcademicDate(date: string) {
  const day = date.slice(0, 10);
  const parsed = new Date(`${day}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? "Data a confirmar" :
    new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

const DIAS_SEMANA = [
  { id: 1, nome: "Segunda" },
  { id: 2, nome: "Terça" },
  { id: 3, nome: "Quarta" },
  { id: 4, nome: "Quinta" },
  { id: 5, nome: "Sexta" },
];

export function TabHorario() {
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("aluno") ?? null;
  const academicYearId = searchParams?.get("ano_letivo_id") ?? null;

  const [data, setData] = useState<TimetableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [horarioError, setHorarioError] = useState(false);
  const [horarioRetry, setHorarioRetry] = useState(0);
  const requestKey = `${studentId ?? "default"}:${academicYearId ?? "active"}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const visibleData = resolvedRequestKey === requestKey ? data : null;
  const timetableLoading = loading || resolvedRequestKey !== requestKey;
  const [activeDay, setActiveDay] = useState<number>(Math.min(5, Math.max(1, new Date().getDay())));
  const [activeTab, setActiveTab] = useState<"horario" | "agenda">("horario");
  const [academicEvents, setAcademicEvents] = useState<AcademicEvent[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [agendaRetry, setAgendaRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setData(null);
    setHorarioError(false);
    setResolvedRequestKey(null);

    const params = new URLSearchParams();
    if (studentId) params.set("studentId", studentId);
    if (academicYearId) params.set("ano_letivo_id", academicYearId);
    const url = `/api/aluno/horario${params.size ? `?${params.toString()}` : ""}`;

    void (async () => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: ctrl.signal });
        const json = await response.json().catch(() => null) as TimetableData | null;
        if (!response.ok || json?.ok !== true) throw new Error("Horário indisponível");
        if (!ctrl.signal.aborted) {
          setData(json);
          setResolvedRequestKey(requestKey);
        }
      } catch {
        if (!ctrl.signal.aborted) {
          setHorarioError(true);
          setResolvedRequestKey(requestKey);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [studentId, academicYearId, horarioRetry, requestKey]);

  const slotsPorDia = useMemo(() => {
    if (!visibleData?.slots) return [];
    return visibleData.slots.filter((s) => s.dia_semana === activeDay);
  }, [visibleData, activeDay]);

  const getAssignment = (slotId: string) => {
    return visibleData?.assignments.find((a) => a.slot_id === slotId);
  };

  // Fonte: calendário oficial, autorizado pela API para aluno/ano/curso/escola.
  // Não construir provas a partir do horário nem inventar datas.
  useEffect(() => {
    if (activeTab !== "agenda") return;
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (studentId) params.set("studentId", studentId);
    if (academicYearId) params.set("ano_letivo_id", academicYearId);
    const query = params.toString();
    setAcademicEvents([]);
    setAgendaError(null);
    setAgendaLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/aluno/home/academic-events${query ? `?${query}` : ""}`, {
          cache: "no-store", signal: ctrl.signal,
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || json?.ok !== true || !Array.isArray(json.items)) {
          throw new Error("Não foi possível consultar os próximos eventos.");
        }
        if (ctrl.signal.aborted) return;
        const items = (json.items as unknown[]).filter((event): event is AcademicEvent => {
          if (!event || typeof event !== "object") return false;
          const item = event as Partial<AcademicEvent>;
          return typeof item.id === "string" && typeof item.nome === "string"
            && typeof item.tipo === "string" && typeof item.data_inicio === "string"
            && typeof item.data_fim === "string";
        });
        setAcademicEvents(items.slice(0, 3));
      } catch {
        if (!ctrl.signal.aborted) setAgendaError("Não foi possível carregar os eventos do teu curso.");
      } finally {
        if (!ctrl.signal.aborted) setAgendaLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [studentId, academicYearId, activeTab, agendaRetry]);

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-1 px-1">
        <h2 className="text-xl font-semibold text-primary tracking-tight">Horário e calendário</h2>
        <p className="text-xs font-medium text-muted-foreground">Consulta o teu horário e os próximos eventos do ano letivo.</p>
        {visibleData?.context?.anoLetivoLabel && (
          <p className="text-xs font-semibold text-primary">
            Ano letivo {visibleData.context.anoLetivoLabel}
            {visibleData.context.mode === "HISTORICAL_READ" ? " · Histórico" : ""}
          </p>
        )}
      </header>

      {/* Switcher Sóbrio de Modos */}
      <div className="flex w-full rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("horario")}
          className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "horario"
              ? "bg-card text-primary shadow-sm ring-1 ring-klasse-gold/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Grade de Aulas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("agenda")}
          className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${
            activeTab === "agenda"
              ? "bg-card text-primary shadow-sm ring-1 ring-klasse-gold/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Próximos eventos
        </button>
      </div>

      {/* MODO 1: Grade de Aulas Semanal */}
      {activeTab === "horario" && (timetableLoading ? (
        <TableSkeleton rows={5} cols={1} />
      ) : horarioError ? (
        <section role="alert" className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-foreground">Não foi possível consultar o horário.</p>
          <button type="button" onClick={() => setHorarioRetry(current => current + 1)}
            className="mt-3 min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-primary hover:bg-muted">
            Tentar novamente
          </button>
        </section>
      ) : !visibleData?.version ? (
        <section className="rounded-xl border border-border bg-card p-6 text-center">
          <Calendar className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
          <h3 className="mt-2 text-base font-semibold text-foreground">
            {visibleData?.reason === "NO_ENROLLMENT" ? "Sem matrícula neste ano letivo"
              : visibleData?.reason === "NO_CLASS" ? "Turma ainda não atribuída"
              : "Horário ainda não publicado"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {visibleData?.reason === "NO_ENROLLMENT"
              ? "Não existe matrícula associada a este aluno no ano selecionado."
              : visibleData?.reason === "NO_CLASS"
                ? "A escola ainda não associou a matrícula a uma turma neste ano."
                : "Assim que a escola publicar o horário desta turma, vais vê-lo aqui."}
          </p>
        </section>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Selector de Dias */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {DIAS_SEMANA.map((dia) => (
              <button
                key={dia.id}
                onClick={() => setActiveDay(dia.id)}
                className={`flex-shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeDay === dia.id
                    ? "bg-klasse-gold text-klasse-gold-900 shadow-sm"
                    : "bg-card text-foreground border border-border hover:bg-muted"
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
      ))}

      {/* Próximos eventos do calendário académico oficial */}
      {activeTab === "agenda" && (
        <section className="space-y-3" aria-label="Próximos eventos académicos">
          {agendaLoading ? (
            <p role="status" className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">A consultar o calendário…</p>
          ) : agendaError ? (
            <div role="alert" className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-foreground">{agendaError}</p>
              <button type="button" onClick={() => setAgendaRetry((current) => current + 1)}
                className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-primary hover:bg-muted">
                Tentar novamente
              </button>
            </div>
          ) : academicEvents.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">Sem eventos próximos</p>
              <p className="mt-1 text-sm text-muted-foreground">Ainda não há avaliações ou eventos futuros publicados para o teu curso.</p>
            </div>
          ) : academicEvents.map((item) => (
            <article key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <FileCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.nome}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatAcademicDate(item.data_inicio)}
                    {item.data_fim.slice(0, 10) !== item.data_inicio.slice(0, 10)
                      ? ` — ${formatAcademicDate(item.data_fim)}` : ""}
                  </p>
                </div>
              </div>
            </article>
          ))}
          {academicEvents.length > 0 && (
            <p className="text-xs text-muted-foreground">Mostramos até três eventos futuros. As datas vêm do calendário da escola.</p>
          )}
        </section>
      )}

    </div>
  );
}
