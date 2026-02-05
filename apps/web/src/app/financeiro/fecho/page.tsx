"use client";

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

// --- TYPES ---
type FechoItem = {
  id: string;
  hora: string;
  aluno: string;
  operador: string;
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
};

const formatKz = (value: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(value || 0);

export const dynamic = "force-dynamic";

export default function FechoCaixaPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<FechoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const [scope, setScope] = useState<"self" | "all">("self");
  const [declaring, setDeclaring] = useState(false);
  const [declared, setDeclared] = useState({ cash: "", tpa: "", transfer: "", mcx: "" });
  const [fechoResult, setFechoResult] = useState<FechoDeclaracao | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<"approved" | "rejected">("approved");
  const [approvalNote, setApprovalNote] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/financeiro/fecho?date=${date}&operador_scope=${scope}`,
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
  }, [date, scope]);

  const totals = data?.totals || { especie: 0, tpa: 0, transferencia: 0, mcx: 0, total: 0 };
  const rows = useMemo(() => data?.items || [], [data]);

  const declareFecho = async () => {
    setDeclaring(true);
    try {
      const payload = {
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
        headers: { "Content-Type": "application/json" },
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
    if (!fechoResult?.id) return;
    setApproving(true);
    try {
      const res = await fetch("/api/financeiro/fecho/aprovar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecho_id: fechoResult.id,
          aprovacao: approvalStatus,
          justificativa: approvalNote || null,
          meta: { origem: "portal_financeiro" },
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
    <main className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-8">
      
      {/* HEADER DE GESTÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            Controle Financeiro
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Fecho de Caixa</h1>
          <p className="text-slate-500 mt-1">Auditória e consolidação diária de valores.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Data */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#E3B23C]">
              <Calendar className="h-4 w-4" />
            </div>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#E3B23C] focus:ring-1 focus:ring-[#E3B23C] cursor-pointer"
            />
          </div>

          {/* Botão de Impressão */}
          <Link
            href={`/financeiro/fecho/print?date=${date}&operador_scope=${scope}`}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition-all"
          >
            <Printer className="h-4 w-4" />
            Imprimir Relatório
          </Link>
        </div>
      </div>

      {/* BARRA DE FILTROS & STATUS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        
        {/* Toggle de Escopo */}
        <div className="flex p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setScope("self")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
              scope === "self" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Meus Lançamentos
          </button>
          <button
            onClick={() => setScope("all")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
              scope === "all" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Visão Geral (Escola)
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 px-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando dados...
          </div>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Declaração cega</h2>
            <p className="text-xs text-slate-500">Informe os valores antes do snapshot do sistema.</p>
          </div>
          <Button
            onClick={declareFecho}
            disabled={declaring}
            className="bg-klasse-gold text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {declaring ? "Declarando..." : "Declarar Fecho"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="number"
            value={declared.cash}
            onChange={(e) => setDeclared((prev) => ({ ...prev, cash: e.target.value }))}
            placeholder="Cash"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={declared.tpa}
            onChange={(e) => setDeclared((prev) => ({ ...prev, tpa: e.target.value }))}
            placeholder="TPA"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={declared.transfer}
            onChange={(e) => setDeclared((prev) => ({ ...prev, transfer: e.target.value }))}
            placeholder="Transfer"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={declared.mcx}
            onChange={(e) => setDeclared((prev) => ({ ...prev, mcx: e.target.value }))}
            placeholder="MCX"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        {fechoResult ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Snapshot do sistema</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm text-slate-600">
              <div>Cash: {formatKz(Number(fechoResult.system_cash ?? 0))}</div>
              <div>TPA: {formatKz(Number(fechoResult.system_tpa ?? 0))}</div>
              <div>Transfer: {formatKz(Number(fechoResult.system_transfer ?? 0))}</div>
              <div>MCX: {formatKz(Number(fechoResult.system_mcx ?? 0))}</div>
            </div>
            <div className="text-xs text-slate-500">Status: {fechoResult.status ?? "—"}</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={approvalStatus}
                onChange={(e) => setApprovalStatus(e.target.value as "approved" | "rejected")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="approved">Aprovar</option>
                <option value="rejected">Rejeitar</option>
              </select>
              <input
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Justificativa"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <Button
                onClick={aprovarFecho}
                disabled={approving}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                {approving ? "Salvando..." : "Atualizar"}
              </Button>
            </div>
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
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Em Espécie</p>
              <p className="text-[10px] text-slate-400">Gaveta física</p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#1F6B3B]/10 text-[#1F6B3B]">
              <Banknote className="w-5 h-5" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{formatKz(totals.especie)}</p>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-[#1F6B3B]" />
        </div>

        {/* Card TPA/Digital */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Digital / Bancário</p>
              <p className="text-[10px] text-slate-400">TPA + Transferências + MCX</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
              <CreditCard className="w-5 h-5" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">
            {formatKz(totals.tpa + totals.transferencia + totals.mcx)}
          </p>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-400" />
        </div>

        {/* Card Total */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Consolidado</p>
              <p className="text-[10px] text-slate-400">Total arrecadado</p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#E3B23C]/10 text-[#E3B23C]">
              <Wallet className="w-5 h-5" strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#E3B23C] tracking-tight">{formatKz(totals.total)}</p>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-[#E3B23C]" />
        </div>
      </section>

      {/* TABELA DE LANÇAMENTOS */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            Extrato de Movimentações
          </h3>
          <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
            {rows.length} registros
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-xs uppercase text-slate-400 font-bold tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3">Hora</th>
                <th className="px-6 py-3">Aluno / Responsável</th>
                <th className="px-6 py-3">Operador</th>
                <th className="px-6 py-3">Descrição</th>
                <th className="px-6 py-3">Método</th>
                <th className="px-6 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center flex flex-col items-center justify-center gap-2">
                    <Search className="w-8 h-8 text-slate-200" />
                    <span className="text-slate-500 font-medium">Nenhum lançamento encontrado.</span>
                    <span className="text-xs text-slate-400">Verifique a data ou o filtro de operador.</span>
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{row.hora}</td>
                  <td className="px-6 py-4 font-bold text-slate-700">{row.aluno}</td>
                  <td className="px-6 py-4 text-slate-600">{row.operador}</td>
                  <td className="px-6 py-4 text-slate-600">{row.descricao}</td>
                  <td className="px-6 py-4">
                    <span className={`
                      inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border
                      ${row.metodo === 'CASH' || row.metodo === 'Numerário' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-slate-50 text-slate-600 border-slate-200'}
                    `}>
                      {row.metodo}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 tabular-nums">
                    {formatKz(row.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* OBSERVAÇÕES */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
          Notas de Auditoria / Observações
        </label>
        <textarea
          value={obs}
          onChange={(event) => setObs(event.target.value)}
          placeholder="Registre ocorrências, sobras ou faltas de caixa..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 outline-none transition-all focus:bg-white focus:border-[#E3B23C] focus:ring-1 focus:ring-[#E3B23C] placeholder:text-slate-400"
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <button className="text-xs font-bold text-[#E3B23C] hover:text-amber-600 transition-colors">
            Salvar Nota
          </button>
        </div>
      </section>
    </main>
  );
}
