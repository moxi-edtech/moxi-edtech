"use client";

import { useEffect, useMemo, useState } from "react";

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
        const res = await fetch("/api/formacao/pagamentos", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as
          | { ok: boolean; error?: string; items?: PagamentoItem[] }
          | null;
        if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
          throw new Error(json?.error || "Falha ao carregar pagamentos");
        }
        setItems(json.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="grid gap-3.5">
      <h1 className="m-0 text-3xl font-bold text-zinc-900">Pagamentos</h1>
      <p className="m-0 text-zinc-600">
        Histórico de cobranças com situação de pagamento e referência de fatura.
      </p>

      <section className="grid gap-1.5 rounded-xl border border-zinc-200 p-3">
        <strong>Resumo</strong>
        <p className="m-0 text-sm text-zinc-700">Total cobrado: {totais.total}</p>
        <p className="m-0 text-sm text-zinc-700">Total pago: {totais.pagos}</p>
        <p className="m-0 text-sm text-zinc-700">Total pendente: {totais.pendente}</p>
      </section>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <Th>Descrição</Th>
              <Th>Referência</Th>
              <Th>Emissão</Th>
              <Th>Vencimento</Th>
              <Th>Valor</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.descricao}</Td>
                <Td>{item.formacao_faturas_lote?.referencia ?? "-"}</Td>
                <Td>{item.formacao_faturas_lote?.emissao_em ?? "-"}</Td>
                <Td>{item.formacao_faturas_lote?.vencimento_em ?? "-"}</Td>
                <Td>{item.valor_total}</Td>
                <Td>{item.status_pagamento}</Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <Td colSpan={6}>Sem pagamentos registrados neste período.</Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-zinc-200 px-2.5 py-2 text-left font-medium text-zinc-700">{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className="border-b border-zinc-200 px-2.5 py-2 text-zinc-800">{children}</td>;
}
