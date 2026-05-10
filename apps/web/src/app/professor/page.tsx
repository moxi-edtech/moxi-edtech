"use client";

import AssignmentsBanner from "@/components/professor/AssignmentsBanner";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { ClipboardDocumentListIcon, PencilSquareIcon, MapIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

type PendenciasResumo = {
  avaliacoes_pendentes: number;
  faltas_a_lancar: number;
};

type OverviewInfo = {
  escola_nome: string | null;
  primeiro_nome: string | null;
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
  const [pendenciasResumo, setPendenciasResumo] = useState<PendenciasResumo | null>(null);
  const [overview, setOverview] = useState<OverviewInfo | null>(null);
  const pathname = usePathname();
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = getEscolaParamFromPath(pathname) ?? escolaSlug ?? escolaId;
  const professorHref = (path: string) => buildPortalHref(escolaParam, path);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setPendenciasResumo(null);
        const [atribsRes, agendaRes, pendRes, overviewRes] = await Promise.all([
          fetch("/api/professor/atribuicoes", { cache: "no-store" }),
          fetch("/api/professor/agenda", { cache: "no-store" }),
          fetch("/api/professor/dashboard/pendencias", { cache: "no-store" }),
          fetch("/api/professor/dashboard/overview", { cache: "no-store" }),
        ]);
        const atribsJson = await atribsRes.json().catch(() => null);
        const agendaJson = await agendaRes.json().catch(() => null);
        const pendJson = await pendRes.json().catch(() => null);
        const overviewJson = await overviewRes.json().catch(() => null);
        if (!cancelled) {
          setAtribs((atribsJson?.items || []) as AtribItem[]);
          setAgenda((agendaJson?.items || []) as AgendaItem[]);
          if (pendRes.ok && pendJson?.ok) {
            setPendenciasResumo({
              avaliacoes_pendentes: Number(pendJson.avaliacoes_pendentes ?? 0),
              faltas_a_lancar: Number(pendJson.faltas_a_lancar ?? 0),
            });
          } else {
            setPendenciasResumo({ avaliacoes_pendentes: 0, faltas_a_lancar: 0 });
          }
          if (overviewRes.ok && overviewJson?.ok) {
            setOverview({
              escola_nome: overviewJson.escola_nome ?? null,
              primeiro_nome: overviewJson.primeiro_nome ?? null,
            });
          } else {
            setOverview({ escola_nome: null, primeiro_nome: null });
          }
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

  const todayKey = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }, []);

  const aulasHoje = useMemo(() => {
    return agenda.filter((item) => item.dia_semana === todayKey).length;
  }, [agenda, todayKey]);

  const turmasAtivas = turmaMap.length;
  const avaliacoesPendentes = pendenciasResumo?.avaliacoes_pendentes ?? 0;
  const faltasALancar = pendenciasResumo?.faltas_a_lancar ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header>
          <DashboardHeader
            title="Portal do Professor"
            description={[
              overview?.escola_nome ? overview.escola_nome : "Escola",
              overview?.primeiro_nome ? `Professor: ${overview.primeiro_nome}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            breadcrumbs={[
              { label: "Início", href: escolaParam ? `/escola/${escolaParam}` : "/" },
              { label: "Professor" },
            ]}
          />
        </header>
        <AssignmentsBanner />
        <section className="rounded-2xl border border-emerald-950/30 bg-gradient-to-br from-[#0d1f12] via-[#12321d] to-[#1f4028] text-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Resumo do dia</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Hoje no portal</h2>
              <p className="text-sm text-emerald-100/80 mt-1">Acompanhe o que precisa de atenção.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Aulas hoje", value: aulasHoje },
                { label: "Turmas ativas", value: turmasAtivas },
                { label: "Avaliações pendentes", value: avaliacoesPendentes },
                { label: "Faltas a lançar", value: faltasALancar },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-white/10 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-50/70">{item.label}</p>
                  <p className="text-lg font-semibold text-white">{loading ? "—" : item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Minhas turmas</h2>
              <Link href={professorHref("/professor/frequencias")} className="text-xs text-klasse-gold">Registrar presenças</Link>
            </div>
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 animate-pulse">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`turma-skeleton-${idx}`} className="rounded-xl border border-slate-200 p-3 sm:p-4 space-y-2">
                    <div className="h-4 w-28 rounded-md bg-slate-200" />
                    <div className="h-3 w-36 rounded-md bg-slate-200" />
                  </div>
                ))}
              </div>
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
              <Link href={professorHref("/professor/fluxos")} className="text-xs text-klasse-gold">Ver fluxos</Link>
            </div>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`agenda-skeleton-${idx}`} className="space-y-2">
                    <div className="h-3 w-20 rounded-md bg-slate-200" />
                    <div className="rounded-lg border border-slate-200 px-3 py-2 space-y-1">
                      <div className="h-3 w-28 rounded-md bg-slate-200" />
                      <div className="h-3 w-36 rounded-md bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
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
          <Link href={professorHref("/professor/frequencias")} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-klasse-gold/40 transition">
            <div className="w-10 h-10 rounded-lg bg-klasse-gold/10 text-klasse-gold flex items-center justify-center mb-3">
              <ClipboardDocumentListIcon className="w-6 h-6" />
            </div>
            <div className="font-semibold text-slate-900">Registrar Presenças</div>
            <div className="text-sm text-slate-500">Registro diário por turma e disciplina.</div>
          </Link>
          <Link href={professorHref("/professor/notas")} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-klasse-gold/40 transition">
            <div className="w-10 h-10 rounded-lg bg-klasse-gold/10 text-klasse-gold flex items-center justify-center mb-3">
              <PencilSquareIcon className="w-6 h-6" />
            </div>
            <div className="font-semibold text-slate-900">Lançar Notas</div>
            <div className="text-sm text-slate-500">Notas por disciplina e período.</div>
          </Link>
          <Link href={professorHref("/professor/fluxos")} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-klasse-gold/40 transition">
            <div className="w-10 h-10 rounded-lg bg-klasse-gold/10 text-klasse-gold flex items-center justify-center mb-3">
              <MapIcon className="w-6 h-6" />
            </div>
            <div className="font-semibold text-slate-900">Fluxo Acadêmico</div>
            <div className="text-sm text-slate-500">Linha do tempo do ciclo académico.</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
