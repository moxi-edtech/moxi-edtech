"use client";

import { useEffect, useState } from "react";
import { Check, Wallet } from "lucide-react";
import type { Mensalidade } from "./BalcaoAtendimento";
import type { SituacaoBalcaoPayload, SituacaoBalcaoRow } from "@/lib/balcao/student-year-situation";
import { useBalcaoDraftForm } from "./command-center/BalcaoDraftState";
import { BalcaoPautaGrid } from "./BalcaoPautaGrid";
import { BalcaoPautaSourceClassPicker } from "./BalcaoPautaSourceClassPicker";

const endpoint = "/api/secretaria/operacoes-academicas/reconciliacao-historica";
const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });
const needsResult = (row: SituacaoBalcaoRow) => !["transferido", "trancado", "desistente", "anulado"].includes(row.status_persistido ?? "") && row.situacao_resultado !== "homologado";
type Source = { matricula_id: string; permite_notas_historicas: boolean; permite_confirmar_resultado: boolean; tem_notas_reais: boolean };

type Props = {
  snapshot: SituacaoBalcaoPayload; mensalidades: Mensalidade[]; financialVerified: boolean;
  onPay: (id: string) => void; onUpdated: () => Promise<unknown>; onBusyChange: (busy: boolean) => void;
};

/** A chronological projection of actual enrollments; no inferred years or invoices. */
export function BalcaoPercursoAcademico(props: Props) {
  const { snapshot, mensalidades, financialVerified, onPay, onUpdated, onBusyChange } = props;
  const rows = [...(snapshot.records ?? [])].filter(r => r.ano_letivo < snapshot.ano.ano).sort((a,b) => a.ano_letivo-b.ano_letivo);
  const debt = (id: string) => mensalidades.filter(m => m.origem_matricula_id === id && m.atrasada && m.preco > 0).reduce((n,m) => n+m.preco,0);
  const first = rows.find(r => needsResult(r) || debt(r.matricula_id)>0);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = rows.find(r => r.matricula_id === (selected ?? first?.matricula_id));
  const previousPending = active && rows.some(r => r.ano_letivo < active.ano_letivo && (needsResult(r) || debt(r.matricula_id)>0));
  const gap = active && rows.some((r,i) => i>0 && r.ano_letivo<=active.ano_letivo && r.ano_letivo!==rows[i-1].ano_letivo+1);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  if (!rows.length) return null;
  return <section aria-label="Percurso até à matrícula atual" className="mt-4 space-y-3 rounded-xl border border-border p-3">
    <h4 className="font-sora text-sm font-semibold text-emerald">Percurso até {snapshot.ano.label}</h4>
    <ol className="space-y-2">{rows.map(r => <li key={r.matricula_id}>
      <button type="button" disabled={busy} aria-expanded={active?.matricula_id===r.matricula_id}
        onClick={() => setSelected(r.matricula_id)}
        className="flex w-full flex-wrap justify-between gap-2 rounded-xl border border-border p-3 text-left text-sm disabled:opacity-60">
        <span className="font-medium">{r.ano_letivo} · {r.turma_nome ?? "Turma por identificar"}</span>
        <span>{r.situacao_resultado === "homologado" ? r.resultado_oficial === "reprovado" ? "Retido" : "Resultado confirmado" : needsResult(r) ? "Resultado por concluir" : "Movimento registado"}</span>
        <span>{!financialVerified ? "Saldo por verificar" : debt(r.matricula_id)>0 ? money.format(debt(r.matricula_id))+" em dívida" : "Sem dívida vencida"}</span>
      </button></li>)}</ol>
    {active && <div aria-label={`Resolver ${active.ano_letivo}`} className="space-y-3 rounded-xl bg-muted/30 p-3">
      {previousPending ? <>
        <p className="text-sm">Conclua primeiro a etapa anterior.</p>
        {/* A wrong next-year class can block the previous result. Keep the
            existing individual correction reachable without allowing progression. */}
        {snapshot.can_recover_historical && active.status_persistido === "pendente" &&
          <BalcaoPautaSourceClassPicker matriculaId={active.matricula_id} alunoId={active.aluno_id}
            onSaved={async () => { await onUpdated(); setSelected(null); }} />}
      </> : <>
        {gap && <p role="alert" className="text-sm">Há anos sem matrícula registada. Confira o ano e a turma do percurso antes de continuar.</p>}
        {needsResult(active) && snapshot.can_recover_historical && <YearWork key={active.matricula_id+":"+active.turma_id}
          row={active} blocked={Boolean(gap)} onBusyChange={setBusy}
          onUpdated={async () => { await onUpdated(); setSelected(null); }} />}
        {financialVerified && debt(active.matricula_id)>0 && <button type="button" disabled={busy} onClick={() => { setSelected(null); onPay(active.matricula_id); }} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <Wallet size={16}/>Liquidar {money.format(debt(active.matricula_id))} aqui</button>}
      </>}
    </div>}
  </section>;
}

function YearWork({ row, blocked, onUpdated, onBusyChange }: {
  row: SituacaoBalcaoRow; blocked: boolean; onUpdated: () => Promise<unknown>; onBusyChange: (busy: boolean) => void;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [mode, setMode] = useState<"resultado" | "notas">("resultado");
  const [result, setResult] = useState("");
  const [gradeBusy, setGradeBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void fetch(endpoint+"?"+new URLSearchParams({matricula_id:row.matricula_id}), {cache:"no-store",signal:controller.signal})
      .then(async res => { const data = await res.json(); if (!res.ok || data.ok!==true || data.matricula_id!==row.matricula_id) throw new Error(data.error || "Não foi possível consultar este ano."); return data as Source; })
      .then(data => {if (!controller.signal.aborted) {setSource(data); if(data.tem_notas_reais) setMode("notas");}})
      .catch(cause => {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha na consulta.");})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [row.matricula_id,retry]);
  const dirty = Boolean(result) || gradeBusy;
  useBalcaoDraftForm("percurso-result:"+row.matricula_id,result,"",{submitting:saving});
  useEffect(() => {onBusyChange(dirty || saving); return () => onBusyChange(false);},[dirty,saving,onBusyChange]);
  const closeYear = async () => {
    if (loading || saving || gradeBusy || blocked || !source || (mode==="resultado" && (!result || !source.permite_confirmar_resultado))) return;
    if (!window.confirm(mode==="notas" ? `Concluir o ano ${row.ano_letivo} com o resultado calculado?` : `Confirmar ${result==="aprovado"?"aprovação":"retenção"} de ${row.ano_letivo}?`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao:"concluir_ano_percurso",matricula_id:row.matricula_id,modo:mode,...(mode==="resultado"?{resultado_confirmado:result}:{})})});
      const data = await response.json(); if (!response.ok || data.ok!==true) throw new Error(data.error || "Não foi possível concluir este ano.");
      setResult(""); await onUpdated();
    } catch(cause) {setError(cause instanceof Error ? cause.message : "Falha ao concluir.");} finally {setSaving(false);}
  };
  return <div className="space-y-3">
    {loading && <p role="status" className="text-sm">A verificar {row.ano_letivo}…</p>}
    {source && <>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Como concluir ${row.ano_letivo}`}>
        <button type="button" aria-pressed={mode==="resultado"} disabled={saving || gradeBusy || !source.permite_confirmar_resultado} onClick={() => {setMode("resultado");setResult("");}}
          className="rounded-xl border border-border px-3 py-2 text-sm">Confirmar resultado</button>
        {source.permite_notas_historicas && <button type="button" aria-pressed={mode==="notas"} disabled={saving || dirty} onClick={() => setMode("notas")}
          className="rounded-xl border border-border px-3 py-2 text-sm">Lançar notas</button>}
      </div>
      {mode==="resultado" ? <label className="block text-sm">Resultado de {row.ano_letivo}
        <select aria-label={`Resultado de ${row.ano_letivo}`} value={result} disabled={saving || !source.permite_confirmar_resultado} onChange={e => setResult(e.target.value)} className="ml-2 rounded-xl border border-border bg-background p-2 focus:ring-4 focus:ring-amber/20">
          <option value="">Selecionar</option><option value="aprovado">Aprovado</option><option value="reprovado">Retido</option>
        </select></label> : source.permite_notas_historicas && row.turma_id && row.ano_letivo_id &&
        <BalcaoPautaGrid escolaId={row.escola_id} alunoId={row.aluno_id} matriculaId={row.matricula_id} turmaId={row.turma_id} anoLetivoId={row.ano_letivo_id} ano={row.ano_letivo} historical
          onDirtyChange={setGradeBusy} onSaved={async () => {setRetry(n=>n+1); await onUpdated();}} />}
      {!source.tem_notas_reais && <fieldset disabled={saving || dirty}><BalcaoPautaSourceClassPicker matriculaId={row.matricula_id} alunoId={row.aluno_id} onSaved={async () => {await onUpdated();}} /></fieldset>}
      <button type="button" disabled={saving || loading || gradeBusy || blocked || (mode==="resultado" ? !result || !source.permite_confirmar_resultado : !source.permite_notas_historicas)} onClick={() => void closeYear()}
        className="inline-flex items-center gap-2 rounded-xl bg-amber px-3 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">
        <Check size={16}/>{saving ? "A concluir…" : mode==="notas" ? `Concluir ano ${row.ano_letivo}` : "Confirmar e concluir ano"}</button>
    </>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {!source && !loading && <button type="button" onClick={() => setRetry(n=>n+1)} className="rounded-xl border border-border px-3 py-2 text-sm">Tentar novamente</button>}
  </div>;
}
