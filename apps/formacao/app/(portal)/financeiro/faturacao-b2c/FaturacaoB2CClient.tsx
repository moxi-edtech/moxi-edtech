"use client";

import { FormEvent, useEffect, useState } from "react";

type Item = {
  id: string;
  fatura_lote_id: string;
  formando_user_id: string;
  descricao: string;
  valor_total: number;
  status_pagamento: "pendente" | "parcial" | "pago" | "cancelado";
};

type Props = { role: string; userId: string };

export default function FaturacaoB2CClient({ role, userId }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    formando_user_id: role === "formando" ? userId : "",
    descricao: "Propina Formação",
    quantidade: "1",
    preco_unitario: "0",
    desconto: "0",
    vencimento_em: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/formacao/financeiro/faturacao-b2c", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; items?: Item[] } | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) throw new Error(json?.error || "Falha ao carregar cobranças B2C");
      setItems(json.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createItem = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload = {
      formando_user_id: role === "formando" ? userId : form.formando_user_id,
      descricao: form.descricao,
      quantidade: Number(form.quantidade),
      preco_unitario: Number(form.preco_unitario),
      desconto: Number(form.desconto || "0"),
      vencimento_em: form.vencimento_em,
    };

    const res = await fetch("/api/formacao/financeiro/faturacao-b2c", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao emitir cobrança B2C");
      return;
    }

    setForm({
      formando_user_id: role === "formando" ? userId : "",
      descricao: "Propina Formação",
      quantidade: "1",
      preco_unitario: "0",
      desconto: "0",
      vencimento_em: "",
    });
    await load();
  };

  const updateStatus = async (id: string, status_pagamento: Item["status_pagamento"]) => {
    setError(null);
    const res = await fetch("/api/formacao/financeiro/faturacao-b2c", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status_pagamento }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao atualizar status de cobrança");
      return;
    }
    await load();
  };

  const removeItem = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/formacao/financeiro/faturacao-b2c?id=${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao remover cobrança");
      return;
    }
    await load();
  };

  return (
    <div className="grid gap-4">
      <h1 className="m-0 text-3xl font-bold text-zinc-900">Faturação B2C</h1>

      <form onSubmit={createItem} className="grid gap-2 rounded-xl border border-zinc-200 p-3">
        <strong>Nova cobrança B2C</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {role === "formando" ? null : (
            <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.formando_user_id} onChange={(e) => setForm((p) => ({ ...p, formando_user_id: e.target.value }))} placeholder="Formando user_id" required />
          )}
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Descrição" required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.quantidade} onChange={(e) => setForm((p) => ({ ...p, quantidade: e.target.value }))} type="number" min={1} step="0.01" placeholder="Quantidade" required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.preco_unitario} onChange={(e) => setForm((p) => ({ ...p, preco_unitario: e.target.value }))} type="number" min={0} step="0.01" placeholder="Preço unitário" required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.desconto} onChange={(e) => setForm((p) => ({ ...p, desconto: e.target.value }))} type="number" min={0} step="0.01" placeholder="Desconto" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.vencimento_em} onChange={(e) => setForm((p) => ({ ...p, vencimento_em: e.target.value }))} type="date" required />
        </div>
        <button type="submit" className="w-fit rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">Emitir cobrança</button>
      </form>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <section className="rounded-xl border border-zinc-200 p-3">
        <strong>Cobranças B2C</strong>
        <ul className="mb-0">
          {items.map((item) => (
            <li key={item.id} className="mt-2">
              {item.descricao} · {item.valor_total} · {item.status_pagamento}
              <div className="ml-2 inline-flex flex-wrap gap-1.5">
                {(["pendente", "parcial", "pago", "cancelado"] as const).map((status) => (
                  <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50" key={status} type="button" onClick={() => updateStatus(item.id, status)} disabled={item.status_pagamento === status}>{status}</button>
                ))}
                <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => removeItem(item.id)}>Apagar</button>
              </div>
            </li>
          ))}
          {items.length === 0 ? <li>Sem cobranças.</li> : null}
        </ul>
      </section>
    </div>
  );
}
