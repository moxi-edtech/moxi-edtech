"use client";

import AssignmentsBanner from "@/components/professor/AssignmentsBanner";
import { ClipboardDocumentListIcon, PencilSquareIcon, MapIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";

type AtribItem = {
  turma: { id: string; nome: string | null };
  disciplina: { id: string | null; nome: string | null };
};

type AgendaItem = {
  turma_nome: string | null;
  disciplina_nome: string | null;
  sala_nome: string | null;
  dia_semana: number;
  inicio: string;
  fim: string;
};

const dayLabel = (day: number) => {
  switch (day) {
    case 1:
      return "Segunda";
    case 2:
      return "Terça";
    case 3:
      return "Quarta";
    case 4:
      return "Quinta";
    case 5:
      return "Sexta";
    case 6:
      return "Sábado";
    case 7:
      return "Domingo";
    default:
      return "";
  }
};

export default function Page() {
  const [atribs, setAtribs] = useState<AtribItem[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [atribsRes, agendaRes] = await Promise.all([
          fetch("/api/professor/atribuicoes", { cache: "no-store" }),
          fetch("/api/professor/agenda", { cache: "no-store" }),
        ]);
        const atribsJson = await atribsRes.json().catch(() => null);
        const agendaJson = await agendaRes.json().catch(() => null);
        if (!cancelled) {
          setAtribs((atribsJson?.items || []) as AtribItem[]);
          setAgenda((agendaJson?.items || []) as AgendaItem[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const turmaMap = useMemo(() => {
    const map = new Map<string, { nome: string | null; disciplinas: string[] }>();
    for (const item of atribs) {
      const turmaId = item.turma?.id || "";
      if (!turmaId) continue;
      const entry = map.get(turmaId) || { nome: item.turma?.nome ?? null, disciplinas: [] };
      const disciplinaNome = item.disciplina?.nome || "Disciplina";
      if (!entry.disciplinas.includes(disciplinaNome)) entry.disciplinas.push(disciplinaNome);
      map.set(turmaId, entry);
    }
    return Array.from(map.values());
  }, [atribs]);

  const agendaByDay = useMemo(() => {
    const map = new Map<number, AgendaItem[]>();
    for (const item of agenda) {
      const list = map.get(item.dia_semana) || [];
      list.push(item);
      map.set(item.dia_semana, list);
    }
    for (const [day, list] of map.entries()) {
      list.sort((a, b) => a.inicio.localeCompare(b.inicio));
      map.set(day, list);
    }
    return map;
  }, [agenda]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-klasse-green">Portal do Professor</h1>
          <p className="text-sm text-slate-500 mt-1">Resumo das suas turmas e agenda semanal.</p>
        </header>
        <AssignmentsBanner />
        <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Minhas turmas</h2>
              <a href="/professor/frequencias" className="text-xs text-klasse-gold">Registrar presenças</a>
            </div>
            {loading ? (
              <div className="text-sm text-slate-500">Carregando turmas...</div>
            ) : turmaMap.length === 0 ? (
              <div className="text-sm text-slate-500">Nenhuma turma atribuída.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {turmaMap.map((turma) => (
                  <div key={turma.nome ?? Math.random()} className="rounded-xl border border-slate-200 p-4">
                    <div className="font-semibold text-slate-900">{turma.nome || "Turma"}</div>
                    <div className="mt-2 text-sm text-slate-500">
                      {turma.disciplinas.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Agenda semanal</h2>
              <a href="/professor/fluxos" className="text-xs text-klasse-gold">Ver fluxos</a>
            </div>
            {loading ? (
              <div className="text-sm text-slate-500">Carregando agenda...</div>
            ) : agenda.length === 0 ? (
              <div className="text-sm text-slate-500">Nenhuma aula programada.</div>
            ) : (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div key={day}>
                    <div className="text-xs font-semibold text-slate-400 uppercase">{dayLabel(day)}</div>
                    {(agendaByDay.get(day) || []).length === 0 ? (
                      <div className="text-xs text-slate-400 mt-1">Sem aulas</div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {(agendaByDay.get(day) || []).map((item, idx) => (
                          <div key={`${day}-${idx}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                            <div className="font-semibold text-slate-700">{item.disciplina_nome || "Disciplina"}</div>
                            <div className="text-slate-500">
                              {item.turma_nome || "Turma"}
                              {item.sala_nome ? ` • Sala ${item.sala_nome}` : ""}
                              {` • ${item.inicio}–${item.fim}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <a href="/professor/frequencias" className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-klasse-gold/40 transition">
            <div className="w-10 h-10 rounded-lg bg-klasse-gold/10 text-klasse-gold flex items-center justify-center mb-3">
              <ClipboardDocumentListIcon className="w-6 h-6" />
            </div>
            <div className="font-semibold text-slate-900">Registrar Presenças</div>
            <div className="text-sm text-slate-500">Registro diário por turma e disciplina.</div>
          </a>
          <a href="/professor/notas" className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-klasse-gold/40 transition">
            <div className="w-10 h-10 rounded-lg bg-klasse-gold/10 text-klasse-gold flex items-center justify-center mb-3">
              <PencilSquareIcon className="w-6 h-6" />
            </div>
            <div className="font-semibold text-slate-900">Lançar Notas</div>
            <div className="text-sm text-slate-500">Notas por disciplina e período.</div>
          </a>
          <a href="/professor/fluxos" className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-klasse-gold/40 transition">
            <div className="w-10 h-10 rounded-lg bg-klasse-gold/10 text-klasse-gold flex items-center justify-center mb-3">
              <MapIcon className="w-6 h-6" />
            </div>
            <div className="font-semibold text-slate-900">Fluxo Acadêmico</div>
            <div className="text-sm text-slate-500">Linha do tempo do ciclo académico.</div>
          </a>
        </div>
      </div>
    </div>
  );
}
