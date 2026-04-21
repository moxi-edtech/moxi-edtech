"use client";

import { FormEvent, useEffect, useState } from "react";

type Cliente = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  nif: string | null;
  email_financeiro: string | null;
  telefone: string | null;
  status: "ativo" | "inativo";
};

type Fatura = {
  id: string;
  referencia: string;
  cliente_b2b_id: string;
  cohort_id: string | null;
  emissao_em: string;
  vencimento_em: string;
  total_bruto: number;
  total_desconto: number;
  total_liquido: number;
  status: "rascunho" | "emitida" | "parcial" | "paga" | "cancelada";
};

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

export default function FaturacaoB2BClient() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [clienteForm, setClienteForm] = useState({
    nome_fantasia: "",
    razao_social: "",
    nif: "",
    email_financeiro: "",
    telefone: "",
  });

  const [faturaForm, setFaturaForm] = useState({
    cliente_b2b_id: "",
    cohort_id: "",
    vencimento_em: "",
    formando_user_id: "",
    descricao: "Mensalidade Formação",
    quantidade: "1",
    preco_unitario: "0",
    desconto: "0",
  });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [clientesRes, faturasRes, cohortsRes] = await Promise.all([
        fetch("/api/formacao/financeiro/clientes-b2b", { cache: "no-store" }),
        fetch("/api/formacao/financeiro/faturacao-b2b", { cache: "no-store" }),
        fetch("/api/formacao/financeiro/cohort-precos", { cache: "no-store" }),
      ]);

      const clientesJson = (await clientesRes.json().catch(() => null)) as { ok: boolean; error?: string; items?: Cliente[] } | null;
      const faturasJson = (await faturasRes.json().catch(() => null)) as { ok: boolean; error?: string; items?: Fatura[] } | null;
      const cohortsJson = (await cohortsRes.json().catch(() => null)) as { ok: boolean; error?: string; items?: CohortOption[] } | null;

      if (!clientesRes.ok || !clientesJson?.ok || !Array.isArray(clientesJson.items)) {
        throw new Error(clientesJson?.error || "Falha ao carregar clientes B2B");
      }
      if (!faturasRes.ok || !faturasJson?.ok || !Array.isArray(faturasJson.items)) {
        throw new Error(faturasJson?.error || "Falha ao carregar faturas B2B");
      }
      if (!cohortsRes.ok || !cohortsJson?.ok || !Array.isArray(cohortsJson.items)) {
        throw new Error(cohortsJson?.error || "Falha ao carregar turmas");
      }

      setClientes(clientesJson.items);
      setFaturas(faturasJson.items);
      setCohorts(cohortsJson.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCohort = (cohortId: string) => {
    const selected = cohorts.find((cohort) => cohort.id === cohortId) ?? null;
    setFaturaForm((prev) => ({
      ...prev,
      cohort_id: cohortId,
      preco_unitario:
        selected?.valor_referencia != null
          ? String(selected.valor_referencia)
          : prev.preco_unitario,
    }));
  };

  useEffect(() => {
    load();
  }, []);

  const createCliente = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const res = await fetch("/api/formacao/financeiro/clientes-b2b", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(clienteForm),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao criar cliente");
      return;
    }

    setClienteForm({ nome_fantasia: "", razao_social: "", nif: "", email_financeiro: "", telefone: "" });
    await load();
  };

  const updateClienteStatus = async (id: string, status: Cliente["status"]) => {
    setError(null);
    const res = await fetch("/api/formacao/financeiro/clientes-b2b", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao atualizar cliente");
      return;
    }
    await load();
  };

  const removeCliente = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/formacao/financeiro/clientes-b2b?id=${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao remover cliente");
      return;
    }
    await load();
  };

  const createFatura = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const res = await fetch("/api/formacao/financeiro/faturacao-b2b", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cliente_b2b_id: faturaForm.cliente_b2b_id,
        cohort_id: faturaForm.cohort_id || null,
        vencimento_em: faturaForm.vencimento_em,
        itens: [
          {
            formando_user_id: faturaForm.formando_user_id,
            descricao: faturaForm.descricao,
            quantidade: Number(faturaForm.quantidade),
            preco_unitario: Number(faturaForm.preco_unitario),
            desconto: Number(faturaForm.desconto || "0"),
          },
        ],
      }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao criar fatura");
      return;
    }

    setFaturaForm({
      cliente_b2b_id: "",
      cohort_id: "",
      vencimento_em: "",
      formando_user_id: "",
      descricao: "Mensalidade Formação",
      quantidade: "1",
      preco_unitario: "0",
      desconto: "0",
    });
    await load();
  };

  const updateFaturaStatus = async (id: string, status: Fatura["status"]) => {
    setError(null);
    const res = await fetch("/api/formacao/financeiro/faturacao-b2b", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao atualizar fatura");
      return;
    }
    await load();
  };

  const removeFatura = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/formacao/financeiro/faturacao-b2b?id=${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao remover fatura");
      return;
    }
    await load();
  };

  return (
    <div className="grid gap-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">financeiro · b2b</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Faturação B2B</h1>
      </header>

      <form onSubmit={createCliente} className={panelClass}>
        <strong>Novo cliente B2B</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <input className={inputClass} value={clienteForm.nome_fantasia} onChange={(e) => setClienteForm((p) => ({ ...p, nome_fantasia: e.target.value }))} placeholder="Nome fantasia" required />
          <input className={inputClass} value={clienteForm.razao_social} onChange={(e) => setClienteForm((p) => ({ ...p, razao_social: e.target.value }))} placeholder="Razão social" />
          <input className={inputClass} value={clienteForm.nif} onChange={(e) => setClienteForm((p) => ({ ...p, nif: e.target.value }))} placeholder="NIF" />
          <input className={inputClass} value={clienteForm.email_financeiro} onChange={(e) => setClienteForm((p) => ({ ...p, email_financeiro: e.target.value }))} placeholder="Email financeiro" />
          <input className={inputClass} value={clienteForm.telefone} onChange={(e) => setClienteForm((p) => ({ ...p, telefone: e.target.value }))} placeholder="Telefone" />
        </div>
        <button type="submit" className={primaryButtonClass}>Criar cliente</button>
      </form>

      <form onSubmit={createFatura} className={panelClass}>
        <strong>Emitir fatura B2B</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <select className={inputClass} value={faturaForm.cliente_b2b_id} onChange={(e) => setFaturaForm((p) => ({ ...p, cliente_b2b_id: e.target.value }))} required>
            <option value="">Cliente B2B</option>
            {clientes.filter((c) => c.status === "ativo").map((c) => (
              <option key={c.id} value={c.id}>{c.nome_fantasia}</option>
            ))}
          </select>
          <select
            className={inputClass}
            value={faturaForm.cohort_id}
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
          <input className={inputClass} value={faturaForm.vencimento_em} onChange={(e) => setFaturaForm((p) => ({ ...p, vencimento_em: e.target.value }))} type="date" required />
          <input className={inputClass} value={faturaForm.formando_user_id} onChange={(e) => setFaturaForm((p) => ({ ...p, formando_user_id: e.target.value }))} placeholder="Formando user_id" required />
          <input className={inputClass} value={faturaForm.descricao} onChange={(e) => setFaturaForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Descrição" required />
          <input className={inputClass} value={faturaForm.quantidade} onChange={(e) => setFaturaForm((p) => ({ ...p, quantidade: e.target.value }))} type="number" min={1} step="0.01" placeholder="Quantidade" required />
          <input className={inputClass} value={faturaForm.preco_unitario} onChange={(e) => setFaturaForm((p) => ({ ...p, preco_unitario: e.target.value }))} type="number" min={0} step="0.01" placeholder="Preço unitário" required />
          <input className={inputClass} value={faturaForm.desconto} onChange={(e) => setFaturaForm((p) => ({ ...p, desconto: e.target.value }))} type="number" min={0} step="0.01" placeholder="Desconto" />
        </div>
        <button type="submit" className={primaryButtonClass}>Emitir fatura</button>
      </form>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <strong>Clientes</strong>
        <ul className="mb-0 mt-3 grid gap-2 p-0">
          {clientes.map((item) => (
            <li key={item.id} className="list-none rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-sm text-zinc-800">
                  {item.nome_fantasia} <span className="text-zinc-500">({item.status})</span>
                </p>
                <div className="inline-flex gap-1.5">
                  <button className={neutralButtonClass} type="button" onClick={() => updateClienteStatus(item.id, "ativo")} disabled={item.status === "ativo"}>Ativar</button>
                  <button className={neutralButtonClass} type="button" onClick={() => updateClienteStatus(item.id, "inativo")} disabled={item.status === "inativo"}>Inativar</button>
                  <button className={dangerButtonClass} type="button" onClick={() => removeCliente(item.id)}>Apagar</button>
                </div>
              </div>
            </li>
          ))}
          {clientes.length === 0 ? <li>Sem clientes.</li> : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <strong>Faturas B2B</strong>
        <ul className="mb-0 mt-3 grid gap-2 p-0">
          {faturas.map((item) => (
            <li key={item.id} className="list-none rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-sm text-zinc-800">
                  {item.referencia} · {item.total_liquido} · <span className="font-medium">{item.status}</span>
                </p>
                <div className="inline-flex flex-wrap gap-1.5">
                {(["rascunho", "emitida", "parcial", "paga", "cancelada"] as const).map((status) => (
                  <button className={neutralButtonClass} key={status} type="button" onClick={() => updateFaturaStatus(item.id, status)} disabled={item.status === status}>{status}</button>
                ))}
                <button className={dangerButtonClass} type="button" onClick={() => removeFatura(item.id)}>Apagar</button>
                </div>
              </div>
            </li>
          ))}
          {faturas.length === 0 ? <li>Sem faturas.</li> : null}
        </ul>
      </section>
    </div>
  );
}
