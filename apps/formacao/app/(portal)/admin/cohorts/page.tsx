"use client";

import { FormEvent, useEffect, useState } from "react";

type Cohort = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome: string;
  carga_horaria_total: number;
  vagas: number;
  data_inicio: string;
  data_fim: string;
  status: string;
};

export default function CohortsPage() {
  const [items, setItems] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    curso_nome: "",
    carga_horaria_total: "",
    vagas: "",
    data_inicio: "",
    data_fim: "",
    status: "planeada",
  });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/formacao/backoffice/cohorts", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; items?: Cohort[] } | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) throw new Error(json?.error || "Falha ao carregar cohorts");
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const res = await fetch("/api/formacao/backoffice/cohorts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        carga_horaria_total: Number(form.carga_horaria_total),
        vagas: Number(form.vagas),
      }),
    });

    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao criar cohort");
      return;
    }

    setForm({ codigo: "", nome: "", curso_nome: "", carga_horaria_total: "", vagas: "", data_inicio: "", data_fim: "", status: "planeada" });
    load();
  };

  const changeStatus = async (id: string, status: "planeada" | "em_andamento" | "concluida" | "cancelada") => {
    setError(null);
    const res = await fetch("/api/formacao/backoffice/cohorts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao atualizar status do cohort");
      return;
    }
    load();
  };

  const removeItem = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/formacao/backoffice/cohorts?id=${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao remover cohort");
      return;
    }
    load();
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Backoffice • Cohorts</h1>

      <form onSubmit={submit} style={{ display: "grid", gap: 8, border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <strong>Novo cohort</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
          <input value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="Código" />
          <input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome" />
          <input value={form.curso_nome} onChange={(e) => setForm((p) => ({ ...p, curso_nome: e.target.value }))} placeholder="Curso" />
          <input value={form.carga_horaria_total} onChange={(e) => setForm((p) => ({ ...p, carga_horaria_total: e.target.value }))} placeholder="Carga horária" type="number" min={1} />
          <input value={form.vagas} onChange={(e) => setForm((p) => ({ ...p, vagas: e.target.value }))} placeholder="Vagas" type="number" min={1} />
          <input value={form.data_inicio} onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))} type="date" />
          <input value={form.data_fim} onChange={(e) => setForm((p) => ({ ...p, data_fim: e.target.value }))} type="date" />
          <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="planeada">planeada</option>
            <option value="em_andamento">em_andamento</option>
            <option value="concluida">concluida</option>
            <option value="cancelada">cancelada</option>
          </select>
        </div>
        <button type="submit">Criar cohort</button>
      </form>

      {error ? <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0 }}>Carregando...</p> : null}

      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Código</Th><Th>Nome</Th><Th>Curso</Th><Th>Datas</Th><Th>Vagas</Th><Th>Status</Th><Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.codigo}</Td>
                <Td>{item.nome}</Td>
                <Td>{item.curso_nome}</Td>
                <Td>{item.data_inicio} → {item.data_fim}</Td>
                <Td>{item.vagas}</Td>
                <Td>{item.status}</Td>
                <Td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(["planeada", "em_andamento", "concluida", "cancelada"] as const).map((status) => (
                      <button key={status} type="button" onClick={() => changeStatus(item.id, status)} disabled={item.status === status}>
                        {status}
                      </button>
                    ))}
                    <button type="button" onClick={() => removeItem(item.id)}>
                      Apagar
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr><Td colSpan={7}>Sem cohorts cadastrados.</Td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{children}</th>;
}
function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{children}</td>;
}
