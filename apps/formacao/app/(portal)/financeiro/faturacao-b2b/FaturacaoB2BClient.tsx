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
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Faturação B2B</h1>

      <form onSubmit={createCliente} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
        <strong>Novo cliente B2B</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          <input value={clienteForm.nome_fantasia} onChange={(e) => setClienteForm((p) => ({ ...p, nome_fantasia: e.target.value }))} placeholder="Nome fantasia" required />
          <input value={clienteForm.razao_social} onChange={(e) => setClienteForm((p) => ({ ...p, razao_social: e.target.value }))} placeholder="Razão social" />
          <input value={clienteForm.nif} onChange={(e) => setClienteForm((p) => ({ ...p, nif: e.target.value }))} placeholder="NIF" />
          <input value={clienteForm.email_financeiro} onChange={(e) => setClienteForm((p) => ({ ...p, email_financeiro: e.target.value }))} placeholder="Email financeiro" />
          <input value={clienteForm.telefone} onChange={(e) => setClienteForm((p) => ({ ...p, telefone: e.target.value }))} placeholder="Telefone" />
        </div>
        <button type="submit">Criar cliente</button>
      </form>

      <form onSubmit={createFatura} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
        <strong>Emitir fatura B2B</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          <select value={faturaForm.cliente_b2b_id} onChange={(e) => setFaturaForm((p) => ({ ...p, cliente_b2b_id: e.target.value }))} required>
            <option value="">Cliente B2B</option>
            {clientes.filter((c) => c.status === "ativo").map((c) => (
              <option key={c.id} value={c.id}>{c.nome_fantasia}</option>
            ))}
          </select>
          <input value={faturaForm.cohort_id} onChange={(e) => setFaturaForm((p) => ({ ...p, cohort_id: e.target.value }))} placeholder="Cohort ID (opcional)" />
          <input value={faturaForm.vencimento_em} onChange={(e) => setFaturaForm((p) => ({ ...p, vencimento_em: e.target.value }))} type="date" required />
          <input value={faturaForm.formando_user_id} onChange={(e) => setFaturaForm((p) => ({ ...p, formando_user_id: e.target.value }))} placeholder="Formando user_id" required />
          <input value={faturaForm.descricao} onChange={(e) => setFaturaForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Descrição" required />
          <input value={faturaForm.quantidade} onChange={(e) => setFaturaForm((p) => ({ ...p, quantidade: e.target.value }))} type="number" min={1} step="0.01" placeholder="Quantidade" required />
          <input value={faturaForm.preco_unitario} onChange={(e) => setFaturaForm((p) => ({ ...p, preco_unitario: e.target.value }))} type="number" min={0} step="0.01" placeholder="Preço unitário" required />
          <input value={faturaForm.desconto} onChange={(e) => setFaturaForm((p) => ({ ...p, desconto: e.target.value }))} type="number" min={0} step="0.01" placeholder="Desconto" />
        </div>
        <button type="submit">Emitir fatura</button>
      </form>

      {error ? <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0 }}>Carregando...</p> : null}

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <strong>Clientes</strong>
        <ul style={{ marginBottom: 0 }}>
          {clientes.map((item) => (
            <li key={item.id} style={{ marginTop: 8 }}>
              {item.nome_fantasia} ({item.status})
              <div style={{ display: "inline-flex", gap: 6, marginLeft: 8 }}>
                <button type="button" onClick={() => updateClienteStatus(item.id, "ativo")} disabled={item.status === "ativo"}>Ativar</button>
                <button type="button" onClick={() => updateClienteStatus(item.id, "inativo")} disabled={item.status === "inativo"}>Inativar</button>
                <button type="button" onClick={() => removeCliente(item.id)}>Apagar</button>
              </div>
            </li>
          ))}
          {clientes.length === 0 ? <li>Sem clientes.</li> : null}
        </ul>
      </section>

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <strong>Faturas B2B</strong>
        <ul style={{ marginBottom: 0 }}>
          {faturas.map((item) => (
            <li key={item.id} style={{ marginTop: 8 }}>
              {item.referencia} · {item.total_liquido} · {item.status}
              <div style={{ display: "inline-flex", gap: 6, marginLeft: 8, flexWrap: "wrap" }}>
                {(["rascunho", "emitida", "parcial", "paga", "cancelada"] as const).map((status) => (
                  <button key={status} type="button" onClick={() => updateFaturaStatus(item.id, status)} disabled={item.status === status}>{status}</button>
                ))}
                <button type="button" onClick={() => removeFatura(item.id)}>Apagar</button>
              </div>
            </li>
          ))}
          {faturas.length === 0 ? <li>Sem faturas.</li> : null}
        </ul>
      </section>
    </div>
  );
}
