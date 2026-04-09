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

export default function FaturacaoB2BClient() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
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
      const [clientesRes, faturasRes] = await Promise.all([
        fetch("/api/formacao/financeiro/clientes-b2b", { cache: "no-store" }),
        fetch("/api/formacao/financeiro/faturacao-b2b", { cache: "no-store" }),
      ]);

      const clientesJson = (await clientesRes.json().catch(() => null)) as { ok: boolean; error?: string; items?: Cliente[] } | null;
      const faturasJson = (await faturasRes.json().catch(() => null)) as { ok: boolean; error?: string; items?: Fatura[] } | null;

      if (!clientesRes.ok || !clientesJson?.ok || !Array.isArray(clientesJson.items)) {
        throw new Error(clientesJson?.error || "Falha ao carregar clientes B2B");
      }
      if (!faturasRes.ok || !faturasJson?.ok || !Array.isArray(faturasJson.items)) {
        throw new Error(faturasJson?.error || "Falha ao carregar faturas B2B");
      }

      setClientes(clientesJson.items);
      setFaturas(faturasJson.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
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
    <div className="grid gap-4">
      <h1 className="m-0 text-3xl font-bold text-zinc-900">Faturação B2B</h1>

      <form onSubmit={createCliente} className="grid gap-2 rounded-xl border border-zinc-200 p-3">
        <strong>Novo cliente B2B</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={clienteForm.nome_fantasia} onChange={(e) => setClienteForm((p) => ({ ...p, nome_fantasia: e.target.value }))} placeholder="Nome fantasia" required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={clienteForm.razao_social} onChange={(e) => setClienteForm((p) => ({ ...p, razao_social: e.target.value }))} placeholder="Razão social" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={clienteForm.nif} onChange={(e) => setClienteForm((p) => ({ ...p, nif: e.target.value }))} placeholder="NIF" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={clienteForm.email_financeiro} onChange={(e) => setClienteForm((p) => ({ ...p, email_financeiro: e.target.value }))} placeholder="Email financeiro" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={clienteForm.telefone} onChange={(e) => setClienteForm((p) => ({ ...p, telefone: e.target.value }))} placeholder="Telefone" />
        </div>
        <button type="submit" className="w-fit rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">Criar cliente</button>
      </form>

      <form onSubmit={createFatura} className="grid gap-2 rounded-xl border border-zinc-200 p-3">
        <strong>Emitir fatura B2B</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <select className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={faturaForm.cliente_b2b_id} onChange={(e) => setFaturaForm((p) => ({ ...p, cliente_b2b_id: e.target.value }))} required>
            <option value="">Cliente B2B</option>
            {clientes.filter((c) => c.status === "ativo").map((c) => (
              <option key={c.id} value={c.id}>{c.nome_fantasia}</option>
            ))}
          </select>
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={faturaForm.cohort_id} onChange={(e) => setFaturaForm((p) => ({ ...p, cohort_id: e.target.value }))} placeholder="Cohort ID (opcional)" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={faturaForm.vencimento_em} onChange={(e) => setFaturaForm((p) => ({ ...p, vencimento_em: e.target.value }))} type="date" required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={faturaForm.formando_user_id} onChange={(e) => setFaturaForm((p) => ({ ...p, formando_user_id: e.target.value }))} placeholder="Formando user_id" required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={faturaForm.descricao} onChange={(e) => setFaturaForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Descrição" required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={faturaForm.quantidade} onChange={(e) => setFaturaForm((p) => ({ ...p, quantidade: e.target.value }))} type="number" min={1} step="0.01" placeholder="Quantidade" required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={faturaForm.preco_unitario} onChange={(e) => setFaturaForm((p) => ({ ...p, preco_unitario: e.target.value }))} type="number" min={0} step="0.01" placeholder="Preço unitário" required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={faturaForm.desconto} onChange={(e) => setFaturaForm((p) => ({ ...p, desconto: e.target.value }))} type="number" min={0} step="0.01" placeholder="Desconto" />
        </div>
        <button type="submit" className="w-fit rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">Emitir fatura</button>
      </form>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <section className="rounded-xl border border-zinc-200 p-3">
        <strong>Clientes</strong>
        <ul className="mb-0">
          {clientes.map((item) => (
            <li key={item.id} className="mt-2">
              {item.nome_fantasia} ({item.status})
              <div className="ml-2 inline-flex gap-1.5">
                <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => updateClienteStatus(item.id, "ativo")} disabled={item.status === "ativo"}>Ativar</button>
                <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => updateClienteStatus(item.id, "inativo")} disabled={item.status === "inativo"}>Inativar</button>
                <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => removeCliente(item.id)}>Apagar</button>
              </div>
            </li>
          ))}
          {clientes.length === 0 ? <li>Sem clientes.</li> : null}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 p-3">
        <strong>Faturas B2B</strong>
        <ul className="mb-0">
          {faturas.map((item) => (
            <li key={item.id} className="mt-2">
              {item.referencia} · {item.total_liquido} · {item.status}
              <div className="ml-2 inline-flex flex-wrap gap-1.5">
                {(["rascunho", "emitida", "parcial", "paga", "cancelada"] as const).map((status) => (
                  <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50" key={status} type="button" onClick={() => updateFaturaStatus(item.id, status)} disabled={item.status === status}>{status}</button>
                ))}
                <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => removeFatura(item.id)}>Apagar</button>
              </div>
            </li>
          ))}
          {faturas.length === 0 ? <li>Sem faturas.</li> : null}
        </ul>
      </section>
    </div>
  );
}
