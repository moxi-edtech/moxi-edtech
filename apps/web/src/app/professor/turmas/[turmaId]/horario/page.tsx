"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

const days = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
type HorarioItem = { slot_id: string; disciplina_id: string; disciplina_nome: string | null; dia_semana: number; inicio: string; fim: string; sala_nome: string | null; ordem: number };

export default function ProfessorTurmaHorarioPage() {
  const params = useParams<{ turmaId: string }>();
  const turmaId = params?.turmaId;
  const [payload, setPayload] = useState<{ ok: boolean; publicado: boolean; turma?: { nome?: string | null }; items?: HorarioItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!turmaId) return; setLoading(true); setError(null); try { const response = await fetch(`/api/professor/turmas/${turmaId}/horario`, { cache: "no-store" }); const json = await response.json().catch(() => null); if (!response.ok || !json?.ok) throw new Error(json?.message ?? json?.error ?? "Não foi possível carregar o horário."); setPayload(json); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar o horário."); } finally { setLoading(false); } }, [turmaId]);
  useEffect(() => { void load(); }, [load]);
  const grouped = useMemo<Map<number, HorarioItem[]>>(() => (payload?.items ?? []).reduce((acc, item) => { const list = acc.get(item.dia_semana) ?? []; list.push(item); acc.set(item.dia_semana, list); return acc; }, new Map<number, HorarioItem[]>()), [payload]);
  return <div className="min-h-screen bg-slate-50"><div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6"><DashboardHeader title={`Horário · ${payload?.turma?.nome ?? "Turma"}`} description="Quadro publicado da turma, compartilhado com os professores associados." breadcrumbs={[{ label: "Início", href: "/" }, { label: "Professor", href: "/professor" }, { label: "Horário" }]} />{error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-black text-white">Tentar novamente</button></div> : loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">A carregar horário...</div> : !payload ? null : !payload.publicado ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">A escola ainda não publicou o horário desta turma.</div> : grouped.size === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">O horário ainda não tem aulas publicadas para esta turma.</div> : <div className="grid gap-4 md:grid-cols-2">{Array.from(grouped.entries()).map(([day, items]) => <section key={day} className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="mb-3 font-black text-slate-900">{days[day]}</h2><div className="space-y-2">{items.map((item) => <div key={`${item.slot_id}-${item.disciplina_id}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="font-bold text-slate-900">{item.disciplina_nome}</p><p className="text-xs text-slate-500">{item.inicio.slice(0, 5)}–{item.fim.slice(0, 5)}{item.sala_nome ? ` · ${item.sala_nome}` : ""}</p></div><span className="text-xs font-black text-slate-400">{item.ordem}º</span></div>)}</div></section>)}</div>}</div></div>;
}
