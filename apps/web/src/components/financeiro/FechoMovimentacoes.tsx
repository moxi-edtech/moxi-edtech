"use client";

import { useEffect, useState } from "react";
import { Banknote, Building2, CreditCard, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Scope = "self" | "all";
type Movement = { id: string; hora: string; aluno: string; operador: string; descricao: string; metodo: string; valor: number };
type Report = { date: string; totals: { especie: number; tpa: number; transferencia: number; mcx: number; total: number }; items: Movement[] };
const money = (value: number) => new Intl.NumberFormat("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " Kz";
const labels: Record<string, string> = { especie: "Numerário", tpa: "TPA", transferencia: "Transferência", mcx: "MCX", outros: "Não classificado" };

export default function FechoMovimentacoes({ escolaId, date, revision }: { escolaId: string; date: string; revision: number }) {
  const [scope, setScope] = useState<Scope>("all");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: Report; error?: string } | null>(null);
  const [limit, setLimit] = useState(50);
  const key = JSON.stringify([escolaId, date, revision, scope, retry]);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ escolaId, date, operador_scope: scope });
    fetch("/api/financeiro/fecho?" + query, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok || !body.ok || body.date !== date) throw new Error(body.error || "Não foi possível consultar as movimentações.");
        if (!controller.signal.aborted) setResult({ key, data: body });
      })
      .catch(error => {
        if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : "Não foi possível consultar as movimentações." });
      });
    return () => controller.abort();
  }, [key, escolaId, date, scope]);
  const current = result?.key === key ? result : null;
  const report = current?.data;
  const totals = report?.totals;
  const digital = totals ? totals.tpa + totals.transferencia + totals.mcx : 0;
  const other = totals ? Math.round((totals.total - totals.especie - digital) * 100) / 100 : 0;
  return <section className="space-y-4" aria-label="Movimentações financeiras">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-foreground">Movimentações do dia</h2><p className="text-xs text-muted-foreground">Consulta atual dos pagamentos liquidados. Não altera o snapshot da declaração.</p></div>
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1" role="group" aria-label="Âmbito das movimentações">
        {([{ value: "all", label: "Visão geral da escola", Icon: Building2 }, { value: "self", label: "Meus lançamentos", Icon: User }] as const).map(({value, label, Icon}) =>
          <button key={value} type="button" aria-pressed={scope === value} onClick={() => {setScope(value);setLimit(50);}} className={"flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold " + (scope === value ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}><Icon className="h-4 w-4"/>{label}</button>
        )}
      </div>
    </div>
    {!current && <div role="status" className="grid gap-3 sm:grid-cols-3">{[0,1,2].map(i=><div key={i} className="h-28 animate-pulse rounded-xl bg-muted"/>)}<span className="sr-only">A carregar movimentações...</span></div>}
    {current?.error && <div role="alert" className="rounded-xl border border-border p-4 text-sm text-destructive">{current.error} <Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Tentar novamente</Button></div>}
    {report && totals && <>
      <div className="grid gap-3 sm:grid-cols-3">
        {([{label:"Numerário", subtitle:"Gaveta física", value:totals.especie, Icon:Banknote}, {label:"Digital / Bancário",subtitle:"TPA + Transferências + MCX",value:digital,Icon:CreditCard}, {label:"Total arrecadado",subtitle:"Pagamentos liquidados",value:totals.total,Icon:Wallet}]).map(({label,subtitle,value,Icon})=>
          <div key={label} className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="text-xs text-muted-foreground">{subtitle}</p></div><Icon className="h-5 w-5 shrink-0 text-klasse-green"/></div>
            <p className="mt-4 break-words font-mono text-xl font-semibold text-foreground tabular-nums">{money(value)}</p>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-klasse-green/50"/>
          </div>)}
      </div>
      {other !== 0 && <p className="text-xs text-muted-foreground">O total inclui {money(other)} em meios não classificados.</p>}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3"><h3 className="text-sm font-semibold">Extrato de movimentações</h3><span className="text-xs text-muted-foreground">{report.items.length} registos</span></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{["Hora","Aluno / responsável","Descrição","Método","Operador","Valor"].map(h=><th key={h} scope="col" className={"whitespace-nowrap px-4 py-3 "+(h==="Valor"?"text-right":"")}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">{report.items.slice(0,limit).map(row=><tr key={row.id} className="hover:bg-muted/40"><td className="px-4 py-3 font-mono text-xs">{row.hora}</td><td className="px-4 py-3 font-medium">{row.aluno}</td><td className="px-4 py-3 text-muted-foreground">{row.descricao}</td><td className="px-4 py-3"><span className="whitespace-nowrap rounded-full bg-muted px-2 py-1 text-xs">{labels[row.metodo]??row.metodo}</span></td><td className="px-4 py-3 text-muted-foreground">{row.operador}</td><td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums">{money(row.valor)}</td></tr>)}
          {!report.items.length&&<tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhuma movimentação para a data e o âmbito selecionados.</td></tr>}</tbody></table></div>
        {report.items.length>limit&&<div className="border-t border-border p-3"><Button variant="outline" onClick={()=>setLimit(v=>v+50)}>Mostrar mais ({Math.min(limit,report.items.length)} de {report.items.length})</Button></div>}
      </div>
    </>}
  </section>;
}
