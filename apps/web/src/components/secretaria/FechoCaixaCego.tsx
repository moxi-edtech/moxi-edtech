"use client";

import { useRef, useState, type FormEvent } from "react";
import { Banknote, CreditCard, CheckCircle2, AlertTriangle, Loader2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/Button";

const NOTES = [5000, 2000, 1000, 500, 200, 100];
const format = (value: number) => new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const inputClass = "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20 disabled:opacity-60";
type Channels = { numerario: number; tpa: number; transferencia: number; mcx: number };
type ResultadoFecho = { sistema: Channels; declarado: Channels; diferenca_total: number; outros?: number; outros_count?: number; status: "MATCH" | "DIVERGENT" };
type Props = {
  onConfirm: (data: { numerario_declarado: number; tpa_declarado: number; transferencia_declarada: number; mcx_declarado: number; detalhe_notas: Record<string, number> }) => Promise<ResultadoFecho>;
  onClose: () => void;
};
const CHANNELS = [["numerario", "Numerário"], ["tpa", "TPA"], ["transferencia", "Transferências"], ["mcx", "Multicaixa Express"]] as const;

export default function FechoCaixaCego({ onConfirm, onClose }: Props) {
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [digital, setDigital] = useState({ tpa: "", transferencia: "", mcx: "" });
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultadoFecho | null>(null);
  const cash = NOTES.reduce((sum, note) => sum + note * Number(counts[note] || 0), 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || result) return;
    const values = [cash, ...Object.values(digital).map(Number)];
    if (!values.every(value => Number.isFinite(value) && value >= 0 && value <= 9999999999.99)) {
      setError("Informe valores válidos e não negativos.");
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      setResult(await onConfirm({
        numerario_declarado: cash,
        tpa_declarado: Number(digital.tpa),
        transferencia_declarada: Number(digital.transferencia),
        mcx_declarado: Number(digital.mcx),
        detalhe_notas: Object.fromEntries(NOTES.map(note => [String(note), Number(counts[note] || 0)])),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registar o fecho. Tente novamente.");
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  if (result) return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div role="status" className="flex items-start gap-3">
        {result.status === "MATCH" ? <CheckCircle2 className="h-5 w-5 text-klasse-green" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
        <div><h2 className="font-semibold text-foreground">{result.status === "MATCH" ? "Fecho sem divergências" : "Fecho com divergências"}</h2><p className="text-sm text-muted-foreground">Declaração registada. Consulte os valores por meio de pagamento.</p></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-muted-foreground"><tr><th scope="col" className="p-2 text-left">Meio</th><th scope="col" className="p-2 text-right">Declarado</th><th scope="col" className="p-2 text-right">Sistema</th><th scope="col" className="p-2 text-right">Diferença</th></tr></thead>
          <tbody className="divide-y divide-border">{CHANNELS.map(([key, label]) => {
            const delta = Math.round((result.declarado[key] - result.sistema[key]) * 100) / 100;
            return <tr key={key}><th scope="row" className="p-2 text-left font-medium">{label}</th><td className="p-2 text-right font-mono">{format(result.declarado[key])}</td><td className="p-2 text-right font-mono">{format(result.sistema[key])}</td><td className={`p-2 text-right font-mono ${delta !== 0 ? "text-red-600" : "text-foreground"}`}>{format(delta)}</td></tr>;
          })}</tbody>
        </table>
      </div>
      {!!result.outros_count&&<p role="status" className="rounded-xl border border-amber-200 p-3 text-sm">Pagamentos sem meio classificado: {format(result.outros??0)} ({result.outros_count}). A conferência exige justificação.</p>}
      <p className="text-sm text-muted-foreground">Diferença líquida dos quatro meios: <span className="font-mono text-foreground">{format(result.diferenca_total)}</span></p>
      <Button onClick={onClose}>Voltar à secretaria</Button>
    </section>
  );

  return (
    <form onSubmit={submit} className="space-y-4" aria-busy={submitting}>
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold text-foreground"><Banknote className="h-5 w-5 text-klasse-green" /> Numerário</h2><p className="mt-1 text-sm text-muted-foreground">Indique a quantidade de cada nota.</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Total contado</p><p className="font-mono text-xl font-semibold text-foreground">{format(cash)}</p></div></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{NOTES.map(note => <label key={note} className="space-y-1 rounded-xl border border-border p-3 text-sm"><span className="font-medium">{format(note)}</span><input className={inputClass} inputMode="numeric" pattern="[0-9]*" maxLength={8} placeholder="0" value={counts[note] || ""} disabled={submitting} onChange={event => { if (/^\d*$/.test(event.target.value)) setCounts(prev => ({ ...prev, [note]: event.target.value })); }} /><span className="block text-xs text-muted-foreground">{format(note * Number(counts[note] || 0))}</span></label>)}</div>
      </section>
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div><h2 className="flex items-center gap-2 font-semibold text-foreground"><CreditCard className="h-5 w-5 text-klasse-green" /> Pagamentos digitais</h2><p className="mt-1 text-sm text-muted-foreground">Informe os totais dos comprovativos. Deixe vazio quando não houver movimento.</p></div>
        <div className="grid gap-3 sm:grid-cols-3">{CHANNELS.slice(1).map(([key, label]) => {
          const channel = key as keyof typeof digital;
          return <label key={channel} className="space-y-1 text-sm"><span className="font-medium">{label} (Kz)</span><input type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" className={inputClass} value={digital[channel]} placeholder="0,00" disabled={submitting} onChange={event => setDigital(prev => ({ ...prev, [channel]: event.target.value }))} /></label>;
        })}</div>
      </section>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" disabled={submitting} onClick={onClose} className="border border-border bg-card text-foreground">Cancelar</Button>
        <Button type="submit" disabled={submitting} className="bg-klasse-gold text-klasse-gold-900 hover:brightness-95">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}{submitting ? "A registar..." : "Declarar fecho"}</Button>
      </div>
    </form>
  );
}
