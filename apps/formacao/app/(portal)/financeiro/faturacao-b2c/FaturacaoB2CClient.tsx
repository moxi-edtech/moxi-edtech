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

type Props = {};
type CohortOption = {
  id: string;
  codigo: string;
  nome: string;
  status: string;
  valor_referencia: number | null;
  moeda: string;
};

const panelClass = "grid gap-2 rounded-2xl border border-slate-200 bg-white p-4";
const inputClass = "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm transition-all duration-200 focus:border-[#1F6B3B] focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/20";
const primaryButtonClass = "w-fit rounded-lg border border-klasse-gold bg-klasse-gold px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0";
const neutralButtonClass = "rounded-md border border-zinc-200 px-2 py-1 text-xs transition-all duration-200 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass = "rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 transition-all duration-200 hover:bg-red-50";

export default function FaturacaoB2CClient({}: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    formando_user_id: "",
    cohort_id: "",
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
      const [itemsRes, cohortsRes] = await Promise.all([
        fetch("/api/formacao/financeiro/faturacao-b2c", { cache: "no-store" }),
        fetch("/api/formacao/financeiro/cohort-precos", { cache: "no-store" }),
      ]);
      const itemsJson = (await itemsRes.json().catch(() => null)) as { ok: boolean; error?: string; items?: Item[] } | null;
      const cohortsJson = (await cohortsRes.json().catch(() => null)) as { ok: boolean; error?: string; items?: CohortOption[] } | null;
      if (!itemsRes.ok || !itemsJson?.ok || !Array.isArray(itemsJson.items)) throw new Error(itemsJson?.error || "Falha ao carregar cobranças B2C");
      if (!cohortsRes.ok || !cohortsJson?.ok || !Array.isArray(cohortsJson.items)) throw new Error(cohortsJson?.error || "Falha ao carregar turmas");
      setItems(itemsJson.items);
      setCohorts(cohortsJson.items);
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
      formando_user_id: form.formando_user_id,
      cohort_id: form.cohort_id || null,
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
      formando_user_id: "",
      cohort_id: "",
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

  const handleSelectCohort = (cohortId: string) => {
    const selected = cohorts.find((cohort) => cohort.id === cohortId) ?? null;
    setForm((prev) => ({
      ...prev,
      cohort_id: cohortId,
      preco_unitario:
        selected?.valor_referencia != null
          ? String(selected.valor_referencia)
          : prev.preco_unitario,
    }));
  };

  return (
    <div className="grid gap-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">financeiro · b2c</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Faturação B2C</h1>
      </header>

      <form onSubmit={createItem} className={panelClass}>
        <strong>Nova cobrança B2C</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <input className={inputClass} value={form.formando_user_id} onChange={(e) => setForm((p) => ({ ...p, formando_user_id: e.target.value }))} placeholder="Formando user_id" required />
          <select
            className={inputClass}
            value={form.cohort_id}
            onChange={(e) => handleSelectCohort(e.target.value)}
          >
            <option value="">Turma (opcional)</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.codigo} · {cohort.nome}
                {cohort.valor_referencia != null ? ` · ${cohort.valor_referencia} ${cohort.moeda}` : ""}
              </option>
            ))}
          </select>
          <input className={inputClass} value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Descrição" required />
          <input className={inputClass} value={form.quantidade} onChange={(e) => setForm((p) => ({ ...p, quantidade: e.target.value }))} type="number" min={1} step="0.01" placeholder="Quantidade" required />
          <input className={inputClass} value={form.preco_unitario} onChange={(e) => setForm((p) => ({ ...p, preco_unitario: e.target.value }))} type="number" min={0} step="0.01" placeholder="Preço unitário" required />
          <input className={inputClass} value={form.desconto} onChange={(e) => setForm((p) => ({ ...p, desconto: e.target.value }))} type="number" min={0} step="0.01" placeholder="Desconto" />
          <input className={inputClass} value={form.vencimento_em} onChange={(e) => setForm((p) => ({ ...p, vencimento_em: e.target.value }))} type="date" required />
        </div>
        <button type="submit" className={primaryButtonClass}>Emitir cobrança</button>
      </form>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <strong>Cobranças B2C</strong>
        <ul className="mb-0 mt-3 grid gap-2 p-0">
          {items.map((item) => (
            <li key={item.id} className="list-none rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-sm text-zinc-800">
                  {item.descricao} · {item.valor_total} · <span className="font-medium">{item.status_pagamento}</span>
                </p>
                <div className="inline-flex flex-wrap gap-1.5">
                {(["pendente", "parcial", "pago", "cancelado"] as const).map((status) => (
                  <button className={neutralButtonClass} key={status} type="button" onClick={() => updateStatus(item.id, status)} disabled={item.status_pagamento === status}>{status}</button>
                ))}
                <button className={dangerButtonClass} type="button" onClick={() => removeItem(item.id)}>Apagar</button>
                </div>
              </div>
            </li>
          ))}
          {items.length === 0 ? <li>Sem cobranças.</li> : null}
        </ul>
      </section>
    </div>
  );
}
