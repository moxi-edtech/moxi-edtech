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
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Faturação B2C</h1>

      <form onSubmit={createItem} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
        <strong>Nova cobrança B2C</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          {role === "formando" ? null : (
            <input value={form.formando_user_id} onChange={(e) => setForm((p) => ({ ...p, formando_user_id: e.target.value }))} placeholder="Formando user_id" required />
          )}
          <input value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Descrição" required />
          <input value={form.quantidade} onChange={(e) => setForm((p) => ({ ...p, quantidade: e.target.value }))} type="number" min={1} step="0.01" placeholder="Quantidade" required />
          <input value={form.preco_unitario} onChange={(e) => setForm((p) => ({ ...p, preco_unitario: e.target.value }))} type="number" min={0} step="0.01" placeholder="Preço unitário" required />
          <input value={form.desconto} onChange={(e) => setForm((p) => ({ ...p, desconto: e.target.value }))} type="number" min={0} step="0.01" placeholder="Desconto" />
          <input value={form.vencimento_em} onChange={(e) => setForm((p) => ({ ...p, vencimento_em: e.target.value }))} type="date" required />
        </div>
        <button type="submit">Emitir cobrança</button>
      </form>

      {error ? <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0 }}>Carregando...</p> : null}

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <strong>Cobranças B2C</strong>
        <ul style={{ marginBottom: 0 }}>
          {items.map((item) => (
            <li key={item.id} style={{ marginTop: 8 }}>
              {item.descricao} · {item.valor_total} · {item.status_pagamento}
              <div style={{ display: "inline-flex", gap: 6, marginLeft: 8, flexWrap: "wrap" }}>
                {(["pendente", "parcial", "pago", "cancelado"] as const).map((status) => (
                  <button key={status} type="button" onClick={() => updateStatus(item.id, status)} disabled={item.status_pagamento === status}>{status}</button>
                ))}
                <button type="button" onClick={() => removeItem(item.id)}>Apagar</button>
              </div>
            </li>
          ))}
          {items.length === 0 ? <li>Sem cobranças.</li> : null}
        </ul>
      </section>
    </div>
  );
}
