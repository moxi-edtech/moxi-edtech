"use client";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { 
  Loader2, 
  Printer, 
  Banknote, 
  CreditCard, 
  Wallet, 
  Calendar, 
  Filter,
  User,
  Building2,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useParams } from "next/navigation";

// --- TYPES ---
type FechoItem = {
  id: string;
  hora: string;
  aluno: string;
  valor: number;
  metodo: string;
  descricao: string;
};

type FechoTotals = {
  especie: number;
  tpa: number;
  transferencia: number;
  mcx: number;
  total: number;
};

type FechoResponse = {
  ok: boolean;
  date: string;
  operador_id: string | null;
  operador_label: string;
  escola_nome: string;
  totals: FechoTotals;
  items: FechoItem[];
  error?: string;
};

type FechoDeclaracao = {
  id: string;
  status: string | null;
  day_key: string | null;
  declared_cash: number | null;
  declared_tpa: number | null;
  declared_transfer: number | null;
  declared_mcx: number | null;
  system_cash: number | null;
  system_tpa: number | null;
  system_transfer: number | null;
  system_mcx: number | null;
  revision?: number;
  system_other?: number | null;
  system_other_count?: number | null;
};

const formatKz = (value: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(value || 0);

export const dynamic = "force-dynamic";

export default function FechoCaixaPage() {
  const params = useParams();
  const escolaId = params?.id as string;
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Luanda", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [data, setData] = useState<FechoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const [scope, setScope] = useState<"self" | "all">("all");
  const [declaring, setDeclaring] = useState(false);
  const [declared, setDeclared] = useState({ cash: "", tpa: "", transfer: "", mcx: "" });
  const [fechoResult, setFechoResult] = useState<FechoDeclaracao | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<"approved" | "rejected">("approved");
  const [approvalNote, setApprovalNote] = useState("");

  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/financeiro/fecho?date=${date}&operador_scope=${scope}&escolaId=${escolaId}`,
          { cache: "no-store" }
        );
        const json = (await res.json().catch(() => ({}))) as FechoResponse;
        if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao carregar fecho");
        if (active) setData(json);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Erro ao carregar fecho");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [date, scope, escolaId]);

  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    setFechoResult(null);
    setSnapshotLoading(true);
    setSnapshotError(null);
    setDeclared({ cash: "", tpa: "", transfer: "", mcx: "" });
    setApprovalNote("");
    setApprovalStatus("approved");
    fetch(`/api/financeiro/fecho/declarar?date=${encodeURIComponent(date)}&escolaId=${encodeURIComponent(escolaId)}`, { cache: "no-store" })
      .then(async res => {
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao consultar declaração");
        if (active) setFechoResult(json.data);
      })
      .catch(err => { if (active) setSnapshotError(err instanceof Error ? err.message : "Falha ao consultar declaração"); })
      .finally(() => { if (active) setSnapshotLoading(false); });
    return () => { active = false; };
  }, [date, escolaId]);

  const totals = data?.totals || { especie: 0, tpa: 0, transferencia: 0, mcx: 0, total: 0 };
  const rows = useMemo(() => data?.items || [], [data]);

  const declareFecho = async () => {
    if (!escolaId || scope!=="all" || declaring || snapshotLoading || snapshotError || fechoResult) return;
    setDeclaring(true);
    try {
      const payload = {
        escolaId,
        day_key: date,
        declared: {
          cash: Number(declared.cash || 0),
          tpa: Number(declared.tpa || 0),
          transfer: Number(declared.transfer || 0),
          mcx: Number(declared.mcx || 0),
        },
        meta: { origem: "portal_financeiro" },
      };

      const res = await fetch("/api/financeiro/fecho/declarar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": `fecho-${date}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao declarar fecho");
      setFechoResult(json.data as FechoDeclaracao);
      toast.success("Fecho declarado com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao declarar fecho.");
    } finally {
      setDeclaring(false);
    }
  };

  const aprovarFecho = async () => {
    if (!fechoResult?.id || !escolaId || approving || fechoResult.status !== "declared" || fechoResult.day_key !== date) return;
    setApproving(true);
    try {
      const res = await fetch("/api/financeiro/fecho/aprovar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": `fecho-${fechoResult.id}-${approvalStatus}` },
        body: JSON.stringify({
          escolaId,
          fecho_id: fechoResult.id,
          aprovacao: approvalStatus,
          justificativa: approvalNote.trim() || undefined,
          meta: { expected_revision: fechoResult.revision??1 },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao aprovar fecho");
      setFechoResult(json.data as FechoDeclaracao);
      toast.success("Fecho atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao aprovar fecho.");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-8`}>
      
      {/* HEADER DE GESTÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-6">
        <div>
          <DashboardHeader
            title="Fecho de Caixa"
            description="Auditoria e consolidação diária de valores."
            breadcrumbs={[
              { label: "Início", href: `/escola/${escolaId}` },
              { label: "Financeiro", href: `/escola/${escolaId}/financeiro` },
              { label: "Fecho" },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Data */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-klasse-gold-700 dark:text-klasse-gold-300">
              <Calendar className="h-4 w-4" />
            </div>
            <input
              type="date"
              value={date}
              disabled={declaring || approving}
              onChange={(event) => setDate(event.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground outline-none transition-all focus:border-klasse-gold focus:ring-1 focus:ring-klasse-gold cursor-pointer"
            />
          </div>

          <Link className="rounded-xl border border-border px-4 py-2 text-sm font-medium" href={`/escola/${escolaId}/financeiro/fecho-diario?date=${date}`}>Fecho diário e histórico</Link>
          {/* Botão de Impressão */}
          <Link
            href={`/escola/${escolaId}/financeiro/fecho/print?date=${date}&operador_scope=${scope}`}
            className="flex items-center gap-2 rounded-xl bg-klasse-gold px-5 py-2.5 text-sm font-bold text-klasse-gold-900 shadow-sm hover:brightness-95 transition-all"
          >
            <Printer className="h-4 w-4" />
            Imprimir Relatório
          </Link>
        </div>
      </div>

      {/* BARRA DE FILTROS & STATUS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-2 rounded-xl border border-border shadow-sm">
        
        {/* Toggle de Escopo */}
        <div className="flex p-1 bg-muted rounded-lg">
          <button
            onClick={() => setScope("self")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
              scope === "self" 
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Meus Lançamentos
          </button>
          <button
            onClick={() => setScope("all")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
              scope === "all" 
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Visão Geral (Escola)
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando dados...
          </div>
        )}
      </div>

      <section className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Declaração cega</h2>
            <p className="text-xs text-muted-foreground">Declare os totais da escola inteira. O filtro de operador serve apenas para consultar lançamentos.</p>
          </div>
          <Button
            onClick={declareFecho}
            disabled={scope!=="all" || declaring || snapshotLoading || Boolean(snapshotError) || Boolean(fechoResult)}
            className="bg-amber text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {declaring ? "Declarando..." : "Declarar Fecho"}
          </Button>
        </div>

        {snapshotLoading && <p role="status" className="text-sm text-muted-foreground">A consultar fecho registado...</p>}
        {snapshotError && <p role="alert" className="text-sm text-red-600">{snapshotError}</p>}
        {!fechoResult && !snapshotLoading && !snapshotError && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="number"
            value={declared.cash}
            onChange={(e) => setDeclared((prev) => ({ ...prev, cash: e.target.value }))}
            placeholder="Cash"
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={declared.tpa}
            onChange={(e) => setDeclared((prev) => ({ ...prev, tpa: e.target.value }))}
            placeholder="TPA"
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={declared.transfer}
            onChange={(e) => setDeclared((prev) => ({ ...prev, transfer: e.target.value }))}
            placeholder="Transfer"
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={declared.mcx}
            onChange={(e) => setDeclared((prev) => ({ ...prev, mcx: e.target.value }))}
            placeholder="MCX"
            className="rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>}

        {fechoResult ? (
          <div className="rounded-lg border border-border bg-muted p-4 space-y-3">
            <div className="text-sm font-semibold text-foreground">Snapshot do sistema</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm text-muted-foreground">
              <div>Cash: {formatKz(Number(fechoResult.system_cash ?? 0))}</div>
              <div>TPA: {formatKz(Number(fechoResult.system_tpa ?? 0))}</div>
              <div>Transfer: {formatKz(Number(fechoResult.system_transfer ?? 0))}</div>
              <div>MCX: {formatKz(Number(fechoResult.system_mcx ?? 0))}</div>
              {Number(fechoResult.system_other_count??0)>0&&<div className="text-amber-700">Não classificado: {formatKz(Number(fechoResult.system_other??0))} ({fechoResult.system_other_count} pagamentos)</div>}
            </div>
            <div className="text-sm text-muted-foreground">Estado: {fechoResult.status === "approved" ? "Aprovado" : fechoResult.status === "rejected" ? "Rejeitado" : fechoResult.status === "declared" ? "A aguardar aprovação" : "Por declarar"}</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm text-muted-foreground">{(["cash", "tpa", "transfer", "mcx"] as const).map((key, i) => <div key={key}>{["Numerário", "TPA", "Transferências", "MCX"][i]} declarado: {formatKz(Number(fechoResult[`declared_${key}`] ?? 0))}</div>)}</div>
            {fechoResult.status==="rejected"&&<Link className="text-sm font-medium underline" href={`/escola/${escolaId}/financeiro/fecho-diario?date=${date}`}>Regularizar caixa no Fecho Diário</Link>}
            {fechoResult.status === "declared" && <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={approvalStatus}
                onChange={(e) => setApprovalStatus(e.target.value as "approved" | "rejected")}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="approved">Aprovar</option>
                <option value="rejected">Rejeitar</option>
              </select>
              <input
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Justificativa"
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              />
              <Button
                onClick={aprovarFecho}
                disabled={approving}
                className="bg-klasse-gold text-klasse-gold-900 px-4 py-2 rounded-xl text-sm font-semibold hover:brightness-95 disabled:opacity-60"
              >
                {approving ? "Salvando..." : "Atualizar"}
              </Button>
            </div>}
          </div>
        ) : null}
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          {error}
        </div>
      )}

      {/* KPI CARDS (CLEAN ENTERPRISE) */}
      <section className="grid gap-6 md:grid-cols-3">
        
        {/* Card Numerário */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Em Espécie</p>
              <p className="text-[10px] text-muted-foreground">Gaveta física</p>
            </div>
            <div className="p-2.5 rounded-xl bg-klasse-green/10 text-klasse-green dark:text-klasse-green-300">
              <Banknote className="w-5 h-5" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-3xl font-bold text-foreground tracking-tight">{formatKz(totals.especie)}</p>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-klasse-green" />
        </div>

        {/* Card TPA/Digital */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Digital / Bancário</p>
              <p className="text-[10px] text-muted-foreground">TPA + Transferências + MCX</p>
            </div>
            <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
              <CreditCard className="w-5 h-5" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-3xl font-bold text-foreground tracking-tight">
            {formatKz(totals.tpa + totals.transferencia + totals.mcx)}
          </p>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-muted" />
        </div>

        {/* Card Total */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Consolidado</p>
              <p className="text-[10px] text-muted-foreground">Total arrecadado</p>
            </div>
            <div className="p-2.5 rounded-xl bg-klasse-gold/10 text-klasse-gold-700 dark:text-klasse-gold-300">
              <Wallet className="w-5 h-5" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-3xl font-bold text-klasse-gold-700 dark:text-klasse-gold-300 tracking-tight">{formatKz(totals.total)}</p>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-klasse-gold" />
        </div>
      </section>

      {/* TABELA DE LANÇAMENTOS */}
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/50">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            Extrato de Movimentações
          </h3>
          <span className="text-xs font-medium text-muted-foreground bg-card px-2 py-1 rounded border border-border">
            {rows.length} registros
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-card text-xs uppercase text-muted-foreground font-bold tracking-wider border-b border-border">
              <tr>
                <th className="px-6 py-3">Hora</th>
                <th className="px-6 py-3">Aluno / Responsável</th>
                <th className="px-6 py-3">Descrição</th>
                <th className="px-6 py-3">Método</th>
                <th className="px-6 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center flex flex-col items-center justify-center gap-2">
                    <Search className="w-8 h-8 text-muted-foreground/50" />
                    <span className="text-muted-foreground font-medium">Nenhum lançamento encontrado.</span>
                    <span className="text-xs text-muted-foreground">Verifique a data ou o filtro de operador.</span>
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted transition-colors group">
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{row.hora}</td>
                  <td className="px-6 py-4 font-bold text-foreground">{row.aluno}</td>
                  <td className="px-6 py-4 text-muted-foreground">{row.descricao}</td>
                  <td className="px-6 py-4">
                    <span className={`
                      inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border
                      ${row.metodo === 'CASH' || row.metodo === 'Numerário' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-muted text-muted-foreground border-border'}
                    `}>
                      {row.metodo}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-foreground tabular-nums">
                    {formatKz(row.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* OBSERVAÇÕES */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
          Notas de Auditoria / Observações
        </label>
        <textarea
          value={obs}
          onChange={(event) => setObs(event.target.value)}
          placeholder="Registre ocorrências, sobras ou faltas de caixa..."
          className="w-full rounded-xl border border-border bg-muted p-4 text-sm text-foreground outline-none transition-all focus:bg-card focus:border-klasse-gold focus:ring-1 focus:ring-klasse-gold placeholder:text-muted-foreground"
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <button className="text-xs font-bold text-klasse-gold-700 dark:text-klasse-gold-300 hover:text-amber-600 transition-colors">
            Salvar Nota
          </button>
        </div>
      </section>
    </div>
  );
}
