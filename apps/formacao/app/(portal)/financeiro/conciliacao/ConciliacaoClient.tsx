"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  created_at: string;
  valor_pago: number;
  metodo: string;
  status: string;
  evidence_url: string | null;
  reference: string | null;
  aluno_id: string | null;
};

export default function ConciliacaoClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/formacao/financeiro/conciliacao", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as
          | { ok: boolean; error?: string; items?: Item[] }
          | null;

        if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
          throw new Error(json?.error || "Falha ao carregar comprovativos");
        }

        setItems(json.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const resumo = useMemo(() => {
    const total = items.reduce((sum, item) => sum + Number(item.valor_pago || 0), 0);
    return { total, quantidade: items.length };
  }, [items]);

  return (
    <div className="grid gap-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">financeiro · conciliação</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Central de Conciliação</h1>
        <p className="mt-1 text-sm text-slate-600">Inbox de comprovativos enviados para validação financeira.</p>
      </header>

      <section className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="m-0 text-xs uppercase tracking-[0.16em] text-slate-500">Resumo</p>
        <p className="m-0 text-sm text-slate-700">Comprovativos pendentes/recebidos: {resumo.quantidade}</p>
        <p className="m-0 text-sm text-slate-700">Valor total declarado: {formatMoney(resumo.total)}</p>
      </section>

      {error ? <p className="m-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-slate-700">Carregando central...</p> : null}

      <section className="space-y-2 md:hidden">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{formatMoney(item.valor_pago)}</p>
            <p className="mt-0.5 text-xs text-slate-500">Recebido em: {formatDateTime(item.created_at)}</p>
            <p className="mt-0.5 text-xs text-slate-500">Método: {item.metodo || "-"}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPill(item.status)}`}>{item.status}</span>
              <span className="text-xs text-slate-500">{item.reference ?? "-"}</span>
            </div>
            <div className="mt-2">
              {item.evidence_url ? (
                <a
                  href={item.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-md border border-klasse-gold bg-klasse-gold px-2 py-1 text-xs font-semibold text-white hover:brightness-95"
                >
                  Ver comprovativo
                </a>
              ) : (
                <span className="text-xs text-slate-400">Sem comprovativo</span>
              )}
            </div>
          </article>
        ))}
        {!loading && items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">Sem comprovativos na fila de conciliação.</div>
        ) : null}
      </section>

      <section className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="min-w-[920px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <Th>Recebido em</Th>
              <Th>Método</Th>
              <Th>Valor</Th>
              <Th>Status</Th>
              <Th>Referência</Th>
              <Th>Comprovativo</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{formatDateTime(item.created_at)}</Td>
                <Td>{item.metodo || "-"}</Td>
                <Td>{formatMoney(item.valor_pago)}</Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPill(item.status)}`}>{item.status}</span>
                </Td>
                <Td>{item.reference ?? "-"}</Td>
                <Td>
                  {item.evidence_url ? (
                    <a
                      href={item.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-md border border-klasse-gold bg-klasse-gold px-2 py-1 text-xs font-semibold text-white hover:brightness-95"
                    >
                      Ver comprovativo
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </Td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <tr>
                <Td colSpan={6}>Sem comprovativos na fila de conciliação.</Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-slate-200 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className="border-b border-slate-100 px-3 py-2.5 text-slate-800">{children}</td>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function statusPill(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("pago")) return "bg-emerald-100 text-emerald-700";
  if (normalized.includes("atras")) return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}
