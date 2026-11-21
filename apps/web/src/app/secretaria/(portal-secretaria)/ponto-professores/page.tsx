"use client";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

import { useEffect, useState } from "react";
import { Clock3, Download, RefreshCw } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { OperationalTablePagination, OperationalTableSkeleton } from "@/components/ui/OperationalTableStates";
import { filterAndPaginateOperationalRows } from "@/lib/operacoes/operational-table";
import { useToast } from "@/components/feedback/FeedbackSystem";

type Item = { professor_id: string; professor_nome: string; aulas: number; finalizadas: number; pendentes: number; atrasos: number; saidas_antecipadas: number; horas_previstas: number; horas_realizadas: number; minutos_atraso: number; minutos_saida_antecipada: number; previstas: { horas: number }; realizadas: { horas: number } };
type Aula = { id: string; professor_id: string | null; data: string; inicio_previsto: string | null; fim_previsto: string | null; inicio_real: string | null; fim_real: string | null; status: string };
type Fechamento = { status: "aberto" | "fechado"; fechado_em?: string | null; motivo_reabertura?: string | null };

const currentMonth = new Date().toISOString().slice(0, 7);
const hours = (value: number) => Number.isFinite(value) ? `${value.toFixed(2).replace(".", ",")} h` : "—";
const PAGE_SIZE = 10;

export default function PontoProfessoresPage() {
  const [month, setMonth] = useState(currentMonth);
  const [items, setItems] = useState<Item[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [fechamento, setFechamento] = useState<Fechamento>({ status: "aberto" });
  const [totals, setTotals] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { error: toastError, success } = useToast();
  const { items: pageItems, filteredCount, currentPage } = filterAndPaginateOperationalRows({
    rows: items,
    search: query,
    getSearchText: (item) => item.professor_nome,
    page,
    pageSize: PAGE_SIZE,
  });

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/secretaria/ponto-professores?month=${encodeURIComponent(month)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível carregar o ponto dos professores.");
      setItems(payload.items ?? []); setTotals(payload.totals ?? null);
      setAulas(payload.aulas ?? []);
      setFechamento(payload.fechamento ?? { status: "aberto" });
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
    if (!response.ok || !payload?.ok) { toastError("Não foi possível corrigir a marcação", payload?.error ?? "Verifique os dados e tente novamente."); return; }
    success("Marcação corrigida", "A alteração ficou registada com o motivo informado.");
    await load();
  };

  const changeClosure = async (action: "fechar" | "reabrir") => {
    const motivo = action === "reabrir" ? window.prompt("Motivo da reabertura (mínimo 10 caracteres):", "Correção autorizada pela direção") : undefined;
    if (action === "reabrir" && motivo === null) return;
    const response = await fetch("/api/secretaria/ponto-professores/fechamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, action, motivo }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) { toastError("Não foi possível alterar o mês", payload?.error ?? "Tente novamente."); return; }
    success(action === "fechar" ? "Mês fechado" : "Mês reaberto");
    await load();
  };

  return <div className={`${PORTAL_PAGE_INSET} space-y-6`}><DashboardHeader title="Ponto dos professores" description="Resumo mensal baseado no início e fim reais das aulas." breadcrumbs={[{ label: "Início", href: "/" }, { label: "Secretaria", href: "/secretaria" }, { label: "Ponto dos professores" }]} />
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><label className="text-xs font-bold text-muted-foreground">Mês de referência<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-xl border border-border p-3 text-sm" /></label><p className={`mt-2 text-xs font-bold ${fechamento.status === "fechado" ? "text-emerald-700" : "text-amber-700"}`}>{fechamento.status === "fechado" ? "Mês fechado para correções" : "Mês aberto para correções"}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold text-foreground"><RefreshCw className="h-4 w-4" /> Atualizar</button><button type="button" onClick={exportCsv} disabled={loading || !items.length} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Download className="h-4 w-4" /> Exportar CSV</button>{fechamento.status === "fechado" ? <button type="button" onClick={() => void changeClosure("reabrir")} disabled={loading} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700">Reabrir mês</button> : <button type="button" onClick={() => void changeClosure("fechar")} disabled={loading} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">Fechar mês</button>}</div></div></section>
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-4 text-sm text-foreground">{error}</div>}
    {loading ? <OperationalTableSkeleton label="A carregar ponto dos professores" /> : error ? null : <><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Horas previstas" value={hours(totals?.previstas?.horas ?? 0)} /><Metric label="Horas realizadas" value={hours(totals?.realizadas?.horas ?? 0)} tone="emerald" /><Metric label="Atrasos" value={`${totals?.atrasos ?? 0}`} /><Metric label="Pendentes" value={`${totals?.pendentes ?? 0}`} tone="amber" /></section><section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"><label className="min-w-0 flex-1"><span className="sr-only">Pesquisar professor</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Pesquisar professor por nome" className="min-h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20" /></label><span aria-live="polite" className="text-xs font-semibold text-muted-foreground">{filteredCount} professores</span></div><div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"><table className="min-w-[840px] w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Professor", "Aulas", "Finalizadas", "Pendentes", "Previstas", "Realizadas", "Atrasos", "Saídas antecipadas"].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody>{pageItems.map((item) => <tr key={item.professor_id} className="border-t border-border"><td className="px-4 py-3 font-bold text-foreground">{item.professor_nome}</td><td className="px-4 py-3">{item.aulas}</td><td className="px-4 py-3 text-emerald-700">{item.finalizadas}</td><td className="px-4 py-3 text-amber-700">{item.pendentes}</td><td className="px-4 py-3">{hours(item.previstas.horas)}</td><td className="px-4 py-3">{hours(item.realizadas.horas)}</td><td className="px-4 py-3">{item.atrasos} <span className="text-xs text-muted-foreground">({item.minutos_atraso} min)</span></td><td className="px-4 py-3">{item.saidas_antecipadas} <span className="text-xs text-muted-foreground">({item.minutos_saida_antecipada} min)</span></td></tr>)}{!filteredCount && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground"><Clock3 className="mx-auto mb-2 h-6 w-6" />{items.length ? "Nenhum professor corresponde à pesquisa." : "Sem professores ou aulas registadas neste mês."}</td></tr>}</tbody></table></div><OperationalTablePagination page={currentPage} pageSize={PAGE_SIZE} total={filteredCount} onPageChange={setPage} /></section><section className="rounded-xl border border-border bg-card p-5 shadow-sm"><h2 className="font-black text-foreground">Ocorrências individuais</h2><p className="mt-1 text-xs text-muted-foreground">Ajustes só devem ser usados pela Secretaria, com motivo auditado.</p><div className="mt-4 divide-y divide-slate-100">{aulas.map((aula) => <div key={aula.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-bold text-foreground">{items.find((item) => item.professor_id === aula.professor_id)?.professor_nome ?? "Professor"} · {aula.data}</p><p className="text-xs text-muted-foreground">Previsto {aula.inicio_previsto?.slice(0, 5) ?? "--:--"}–{aula.fim_previsto?.slice(0, 5) ?? "--:--"} · Real {aula.inicio_real ? new Date(aula.inicio_real).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}–{aula.fim_real ? new Date(aula.fim_real).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"} · {aula.status}</p></div><button type="button" onClick={() => void adjustAula(aula)} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/50">Corrigir marcação</button></div>)}{!aulas.length && <p className="py-6 text-sm text-muted-foreground">Nenhuma ocorrência individual neste mês.</p>}</div></section></>}
  </div>;
}

function Metric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "amber" }) { const styles = { slate: "border-border bg-card", emerald: "border-emerald-100 bg-emerald-50", amber: "border-amber-100 bg-amber-50" }; return <div className={`rounded-2xl border p-4 shadow-sm ${styles[tone]}`}><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-black text-foreground">{value}</p></div>; }
