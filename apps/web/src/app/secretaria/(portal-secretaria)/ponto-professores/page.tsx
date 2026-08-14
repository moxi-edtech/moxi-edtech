"use client";

import { useEffect, useState } from "react";
import { Clock3, Download, RefreshCw } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

type Item = { professor_id: string; professor_nome: string; aulas: number; finalizadas: number; pendentes: number; atrasos: number; saidas_antecipadas: number; horas_previstas: number; horas_realizadas: number; minutos_atraso: number; minutos_saida_antecipada: number; previstas: { horas: number }; realizadas: { horas: number } };
type Aula = { id: string; professor_id: string | null; data: string; inicio_previsto: string | null; fim_previsto: string | null; inicio_real: string | null; fim_real: string | null; status: string };

const currentMonth = new Date().toISOString().slice(0, 7);
const hours = (value: number) => `${value.toFixed(2).replace(".", ",")} h`;

export default function PontoProfessoresPage() {
  const [month, setMonth] = useState(currentMonth);
  const [items, setItems] = useState<Item[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [totals, setTotals] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/secretaria/ponto-professores?month=${encodeURIComponent(month)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível carregar o ponto dos professores.");
      setItems(payload.items ?? []); setTotals(payload.totals ?? null);
      setAulas(payload.aulas ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar o relatório."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [month]);

  const exportCsv = () => {
    const header = ["Professor", "Aulas", "Finalizadas", "Pendentes", "Horas previstas", "Horas realizadas", "Atrasos", "Saídas antecipadas"];
    const rows = items.map((item) => [item.professor_nome, item.aulas, item.finalizadas, item.pendentes, item.previstas.horas, item.realizadas.horas, item.atrasos, item.saidas_antecipadas]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `ponto-professores-${month}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const adjustAula = async (aula: Aula) => {
    const start = window.prompt("Início real (ex.: 2026-08-14T08:00:00-01:00). Deixe vazio para remover:", aula.inicio_real ?? "");
    if (start === null) return;
    const end = window.prompt("Fim real (ex.: 2026-08-14T09:30:00-01:00). Deixe vazio para remover:", aula.fim_real ?? "");
    if (end === null) return;
    const motivo = window.prompt("Motivo obrigatório da correção (mínimo 10 caracteres):", "Correção solicitada pela Secretaria");
    if (motivo === null) return;
    const response = await fetch("/api/secretaria/ponto-professores/ajustes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aula_id: aula.id, inicio_real: start.trim() || null, fim_real: end.trim() || null, motivo }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) { window.alert(payload?.error ?? "Não foi possível ajustar o ponto."); return; }
    await load();
  };

  return <main className="mx-auto max-w-7xl space-y-6 p-6"><DashboardHeader title="Ponto dos professores" description="Resumo mensal baseado no início e fim reais das aulas." breadcrumbs={[{ label: "Início", href: "/" }, { label: "Secretaria", href: "/secretaria" }, { label: "Ponto dos professores" }]} />
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><label className="text-xs font-bold text-slate-600">Mês de referência<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-xl border border-slate-200 p-3 text-sm" /></label></div><div className="flex gap-2"><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"><RefreshCw className="h-4 w-4" /> Atualizar</button><button type="button" onClick={exportCsv} disabled={!items.length} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Download className="h-4 w-4" /> Exportar CSV</button></div></div></section>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">A carregar o relatório...</div> : <><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Horas previstas" value={hours(totals?.previstas?.horas ?? 0)} /><Metric label="Horas realizadas" value={hours(totals?.realizadas?.horas ?? 0)} tone="emerald" /><Metric label="Atrasos" value={`${totals?.atrasos ?? 0}`} /><Metric label="Pendentes" value={`${totals?.pendentes ?? 0}`} tone="amber" /></section><section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{["Professor", "Aulas", "Finalizadas", "Pendentes", "Previstas", "Realizadas", "Atrasos", "Saídas antecipadas"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.professor_id} className="border-t border-slate-100"><td className="px-4 py-3 font-bold text-slate-800">{item.professor_nome}</td><td className="px-4 py-3">{item.aulas}</td><td className="px-4 py-3 text-emerald-700">{item.finalizadas}</td><td className="px-4 py-3 text-amber-700">{item.pendentes}</td><td className="px-4 py-3">{hours(item.previstas.horas)}</td><td className="px-4 py-3">{hours(item.realizadas.horas)}</td><td className="px-4 py-3">{item.atrasos} <span className="text-xs text-slate-400">({item.minutos_atraso} min)</span></td><td className="px-4 py-3">{item.saidas_antecipadas} <span className="text-xs text-slate-400">({item.minutos_saida_antecipada} min)</span></td></tr>)}{!items.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500"><Clock3 className="mx-auto mb-2 h-6 w-6" />Sem professores ou aulas registadas neste mês.</td></tr>}</tbody></table></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Ocorrências individuais</h2><p className="mt-1 text-xs text-slate-500">Ajustes só devem ser usados pela Secretaria, com motivo auditado.</p><div className="mt-4 divide-y divide-slate-100">{aulas.map((aula) => <div key={aula.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-bold text-slate-800">{items.find((item) => item.professor_id === aula.professor_id)?.professor_nome ?? "Professor"} · {aula.data}</p><p className="text-xs text-slate-500">Previsto {aula.inicio_previsto?.slice(0, 5) ?? "--:--"}–{aula.fim_previsto?.slice(0, 5) ?? "--:--"} · Real {aula.inicio_real ? new Date(aula.inicio_real).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}–{aula.fim_real ? new Date(aula.fim_real).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"} · {aula.status}</p></div><button type="button" onClick={() => void adjustAula(aula)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Corrigir marcação</button></div>)}{!aulas.length && <p className="py-6 text-sm text-slate-500">Nenhuma ocorrência individual neste mês.</p>}</div></section></>}
  </main>;
}

function Metric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "amber" }) { const styles = { slate: "border-slate-200 bg-white", emerald: "border-emerald-100 bg-emerald-50", amber: "border-amber-100 bg-amber-50" }; return <div className={`rounded-2xl border p-4 shadow-sm ${styles[tone]}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div>; }
