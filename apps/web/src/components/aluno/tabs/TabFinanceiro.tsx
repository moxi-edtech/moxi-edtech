"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Filter, Wallet, ArrowUpCircle, ArrowDownCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PaymentDrawer } from "@/components/aluno/financeiro-portal/PaymentDrawer";
import { usePortalSWR } from "@/components/aluno/usePortalSWR";

type Item = { id: string; competencia: string; valor: number; status: "pago" | "pendente" | "atrasado" | "em_verificacao" };
type Movimento = {
  id: string;
  tipo: "debito" | "credito";
  origem: string;
  valor: number;
  data_movimento: string;
  descricao: string;
};
type ComprovativoStatus = {
  pendentes: number;
  ultimo_envio_em: string | null;
};
type DadosPagamento = {
  iban?: string;
  banco?: string;
  titular?: string;
};
type ApiResponse = {
  ok: boolean;
  mensalidades: Array<Omit<Item, "status"> & { status: string }>;
  movimentos: Movimento[];
  resumo: {
    saldo_consolidado: number;
    total_pago: number;
    total_pendente: number;
    em_dia: boolean;
  };
  comprovativo_status?: ComprovativoStatus;
  dados_pagamento?: DadosPagamento | null;
};
type ParsedFinanceiroPayload = {
  rows: Item[];
  movimentos: Movimento[];
  resumo: ApiResponse["resumo"];
  comprovativoStatus: ComprovativoStatus | null;
  dadosPagamento: DadosPagamento | null;
};

const money = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

function normalizeStatus(value: string): Item["status"] {
  if (value === "pago") return "pago";
  if (value === "em_verificacao") return "em_verificacao";
  if (value === "atrasado") return "atrasado";
  return "pendente";
}

export function TabFinanceiro() {
  const searchParams = useSearchParams();
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [resumo, setResumo] = useState<ApiResponse["resumo"] | null>(null);
  const [comprovativoStatus, setComprovativoStatus] = useState<ComprovativoStatus | null>(null);
  const [dadosPagamento, setDadosPagamento] = useState<DadosPagamento | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [fromAno, setFromAno] = useState(currentYear - 1);
  const [toAno, setToAno] = useState(currentYear);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = currentYear + 1; year >= currentYear - 12; year -= 1) list.push(year);
    return list;
  }, [currentYear]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (studentId) params.set("studentId", studentId);
    params.set("fromAno", String(fromAno));
    params.set("toAno", String(toAno));
    return `?${params.toString()}`;
  }, [studentId, fromAno, toAno]);

  const req = usePortalSWR({
    key: `financeiro-${studentId ?? "default"}-${fromAno}-${toAno}`,
    url: `/api/aluno/financeiro${query}`,
    intervalMs: 30000,
    parse: (payload) => {
      const json = payload as ApiResponse;
      const mapped = (json.mensalidades ?? []).map((m) => ({ ...m, status: normalizeStatus(m.status) }));
      return {
        rows: mapped,
        movimentos: json.movimentos ?? [],
        resumo: json.resumo,
        comprovativoStatus: json.comprovativo_status ?? null,
        dadosPagamento: json.dados_pagamento ?? null,
      } satisfies ParsedFinanceiroPayload;
    },
    onData: (data) => {
      setRows(data.rows);
      setMovimentos(data.movimentos);
      setResumo(data.resumo);
      setComprovativoStatus(data.comprovativoStatus);
      setDadosPagamento(data.dadosPagamento);
      setLoading(false);
    },
  });

  const sortedMensalidades = useMemo(() => [...rows].sort((a, b) => b.competencia.localeCompare(a.competencia)), [rows]);

  const refresh = async () => {
    setRefreshing(true);
    await req.refresh();
    setRefreshing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Financeiro (Livro Razão)</p>
        <button
          onClick={refresh}
          className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-sm"
        >
          {refreshing ? "A atualizar..." : "Atualizar"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Saldo Consolidado</p>
          <p className={`mt-2 text-lg font-bold ${resumo && resumo.saldo_consolidado > 0 ? 'text-red-600' : 'text-klasse-green-700'}`}>
            {resumo ? money.format(resumo.saldo_consolidado) : "—"}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 uppercase">Débitos - Créditos</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Pago</p>
          <p className="mt-2 text-lg font-semibold text-slate-700">{resumo ? money.format(resumo.total_pago) : "—"}</p>
        </div>
        <div className="rounded-2xl border border-klasse-gold-200 bg-klasse-gold-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-klasse-gold-700">A Pagar</p>
          <p className="mt-2 text-lg font-semibold text-klasse-gold-800">{resumo ? money.format(resumo.total_pendente) : "—"}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="fromAno" className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">De</label>
            <select
              id="fromAno"
              value={fromAno}
              onChange={(e) => setFromAno(Number(e.target.value))}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#E3B23C] focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20"
            >
              {years.map((year) => (
                <option key={`from-${year}`} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="toAno" className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Até</label>
            <select
              id="toAno"
              value={toAno}
              onChange={(e) => setToAno(Number(e.target.value))}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#E3B23C] focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20"
            >
              {years.map((year) => (
                <option key={`to-${year}`} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <Button tone="gray" size="sm" className="min-h-10" onClick={refresh}>
            <Filter className="h-4 w-4" /> Aplicar filtro
          </Button>
        </div>
      </div>

      {comprovativoStatus && comprovativoStatus.pendentes > 0 ? (
        <section className="rounded-2xl border border-klasse-gold-200 bg-klasse-gold-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-klasse-gold-700">Comprovativo</p>
          <p className="mt-1 text-sm font-semibold text-klasse-gold-900">
            Comprovativo enviado, aguardando validação da secretaria.
          </p>
          <p className="mt-1 text-xs text-klasse-gold-800">
            Último envio: {comprovativoStatus.ultimo_envio_em
              ? new Date(comprovativoStatus.ultimo_envio_em).toLocaleString("pt-PT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Lado Esquerdo: Mensalidades e Pagamento */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Mensalidades</h2>
            <Info className="h-4 w-4 text-slate-300" />
          </div>
          {loading ? (
            <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <ul className="space-y-2">
              {sortedMensalidades.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.competencia}</p>
                    <p className="text-xs text-slate-500">{money.format(item.valor)}</p>
                  </div>
                  {item.status === "pago" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-klasse-green-50 px-3 py-1 text-xs font-medium text-klasse-green-700">
                      <Check className="h-4 w-4" /> Pago
                    </span>
                  ) : item.status === "em_verificacao" ? (
                    <span className="rounded-full bg-klasse-gold-100 px-3 py-1 text-xs font-medium text-klasse-gold-700">
                      Em Verificação
                    </span>
                  ) : (
                    <Button tone="gold" className="min-h-11" size="sm" onClick={() => setSelected(item)}>
                      <Wallet className="h-4 w-4" /> Pagar
                    </Button>
                  )}
                </li>
              ))}
              {!sortedMensalidades.length ? <li className="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">Sem mensalidades no intervalo selecionado.</li> : null}
            </ul>
          )}
        </section>

        {/* Lado Direito: Histórico de Movimentos (Ledger) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Histórico de Movimentações</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded">Timeline SSOT</p>
          </div>
          {loading ? (
            <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <div className="space-y-4 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
              {movimentos.map((mov) => (
                <div key={mov.id} className="relative pl-10">
                  <div className={`absolute left-0 top-1 p-1 rounded-full bg-white border-2 ${mov.tipo === 'debito' ? 'border-red-200' : 'border-klasse-green-200'}`}>
                    {mov.tipo === 'debito' ? (
                      <ArrowUpCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-klasse-green-600" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{mov.descricao}</span>
                      <span className={`text-xs font-bold ${mov.tipo === 'debito' ? 'text-red-600' : 'text-klasse-green-700'}`}>
                        {mov.tipo === 'debito' ? '+' : '-'}{money.format(mov.valor)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(mov.data_movimento).toLocaleDateString('pt-AO')} • {mov.origem.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {!movimentos.length ? <p className="pl-10 text-sm text-slate-500">Nenhuma movimentação registrada no Livro Razão.</p> : null}
            </div>
          )}
        </section>
      </div>

      <PaymentDrawer
        open={Boolean(selected)}
        mensalidade={selected}
        dadosPagamento={dadosPagamento}
        onClose={() => setSelected(null)}
        onUploaded={(id) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "em_verificacao" } : r)))}
        studentId={studentId}
      />
    </div>
  );
}

