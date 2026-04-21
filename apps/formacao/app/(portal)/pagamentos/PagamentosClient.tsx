"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Wallet, CheckCircle2, Clock, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { PaymentModal } from "@/components/pagamentos/PaymentModal";
import { toast } from "@/lib/toast";

type PagamentoItem = {
  id: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  desconto: number;
  valor_total: number;
  status_pagamento: string;
  formacao_faturas_lote: {
    id: string;
    referencia: string;
    emissao_em: string;
    vencimento_em: string;
    status: string;
  } | null;
};

export default function PagamentosClient() {
  const [items, setItems] = useState<PagamentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PagamentoItem | null>(null);
  const [iban, setIban] = useState<string>("");

  const totais = useMemo(() => {
    const total = items.reduce((sum, item) => sum + Number(item.valor_total || 0), 0);
    const pagos = items
      .filter((item) => item.status_pagamento === "pago")
      .reduce((sum, item) => sum + Number(item.valor_total || 0), 0);
    return { total, pagos, pendente: total - pagos };
  }, [items]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Buscar pagamentos e IBAN
        const [pagRes, ibanRes] = await Promise.all([
          fetch("/api/formacao/pagamentos", { cache: "no-store" }),
          fetch("/api/formacao/financeiro/iban", { cache: "no-store" }).then(r => r.json().catch(() => ({ iban: "" })))
        ]);

        const pagJson = await pagRes.json();
        if (!pagRes.ok || !pagJson?.ok) throw new Error(pagJson?.error || "Falha ao carregar pagamentos");
        
        setItems(pagJson.items);
        setIban(ibanRes.iban || "");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const hasPendingVerification = useMemo(() => items.some(i => i.status_pagamento === 'em_verificacao'), [items]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B]/10 text-[#1F6B3B]">
            <Wallet size={24} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">financeiro</p>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Pagamentos</h1>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Gere as tuas mensalidades e consulte o histórico de faturas do centro.
        </p>
      </header>

      {/* Resumo Financeiro */}
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <SummaryCard title="Total Cobrado" value={totais.total} tone="neutral" />
        <SummaryCard title="Total Pago" value={totais.pagos} tone="positive" />
        <SummaryCard title="Pendente" value={totais.pendente} tone="warning" />
      </section>

      {hasPendingVerification && (
        <section className="rounded-[2rem] border border-[#E3B23C]/20 bg-[#E3B23C]/5 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3B23C]/10 text-[#E3B23C]">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Pagamentos em Verificação</p>
              <p className="text-xs text-slate-500">Enviou comprovativos que estão a ser validados pela secretaria.</p>
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold">
          {error}
        </div>
      )}

      <main className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Lista de Cobranças</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-3xl bg-white border border-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <article 
                key={item.id} 
                className="group bg-white border border-slate-200 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-6 hover:shadow-lg hover:border-[#1F6B3B]/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    item.status_pagamento === 'pago' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">{item.descricao}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Ref: {item.formacao_faturas_lote?.referencia ?? "N/A"}</span>
                      <span>•</span>
                      <span>Vencimento: {item.formacao_faturas_lote?.vencimento_em ?? "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{formatMoney(item.valor_total)}</p>
                    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter ${statusPill(item.status_pagamento)}`}>
                      {item.status_pagamento}
                    </span>
                  </div>

                  {item.status_pagamento !== "pago" && item.status_pagamento !== "em_verificacao" && (
                    <button 
                      onClick={() => setSelectedItem(item)}
                      className="flex h-10 px-4 items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#1F6B3B]/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      Pagar <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </article>
            ))}

            {!loading && items.length === 0 && (
              <div className="py-20 text-center rounded-[2.2rem] bg-white border border-dashed border-slate-200">
                <AlertCircle size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-bold">Sem cobranças registadas.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <PaymentModal 
        open={Boolean(selectedItem)} 
        item={selectedItem}
        iban={iban}
        onClose={() => setSelectedItem(null)}
        onUploaded={(id) => {
          setItems(prev => prev.map(item => item.id === id ? { ...item, status_pagamento: 'em_verificacao' } : item));
        }}
      />
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string, value: number, tone: 'positive' | 'warning' | 'neutral' }) {
  const tones = {
    positive: "bg-emerald-50 border-emerald-100 text-emerald-700",
    warning: "bg-amber-50 border-amber-100 text-amber-700",
    neutral: "bg-slate-50 border-slate-100 text-slate-700",
  };

  return (
    <article className={`rounded-3xl border p-6 ${tones[tone]}`}>
      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{title}</span>
      <p className="mt-2 text-xl font-black">{formatMoney(value)}</p>
    </article>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function statusPill(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("pago")) return "bg-emerald-50 text-emerald-600 border border-emerald-100";
  if (normalized.includes("atras")) return "bg-rose-50 text-rose-600 border border-rose-100";
  if (normalized.includes("verificacao")) return "bg-blue-50 text-blue-600 border border-blue-100";
  return "bg-amber-50 text-amber-600 border border-amber-100";
}
