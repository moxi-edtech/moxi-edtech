"use client";

import { FormEvent, useEffect, useState } from "react";

type Curso = {
  id: string;
  codigo: string;
  nome: string;
  area: string | null;
  modalidade: "presencial" | "online" | "hibrido";
  carga_horaria: number | null;
  status: string;
};

export default function CursosPage() {
  const [items, setItems] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ codigo: "", nome: "", area: "", modalidade: "presencial", carga_horaria: "" });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/formacao/backoffice/cursos", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; items?: Curso[] } | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) throw new Error(json?.error || "Falha ao carregar cursos");
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

    const res = await fetch("/api/formacao/backoffice/cursos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        codigo: form.codigo,
        nome: form.nome,
        area: form.area,
        modalidade: form.modalidade,
        carga_horaria: form.carga_horaria ? Number(form.carga_horaria) : null,
      }),
    });

    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao criar curso");
      return;
    }

    setForm({ codigo: "", nome: "", area: "", modalidade: "presencial", carga_horaria: "" });
    load();
  };

  const changeStatus = async (id: string, status: "ativo" | "inativo") => {
    setError(null);
    const res = await fetch("/api/formacao/backoffice/cursos", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao atualizar status do curso");
      return;
    }
    load();
  };

  const removeItem = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/formacao/backoffice/cursos?id=${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao remover curso");
      return;
    }
    load();
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Backoffice • Cursos</h1>

      <form onSubmit={submit} style={{ display: "grid", gap: 8, border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <strong>Novo curso</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          <input value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="Código" />
          <input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome" />
          <input value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))} placeholder="Área" />
          <select value={form.modalidade} onChange={(e) => setForm((p) => ({ ...p, modalidade: e.target.value }))}>
            <option value="presencial">presencial</option>
            <option value="online">online</option>
            <option value="hibrido">hibrido</option>
          </select>
          <input value={form.carga_horaria} onChange={(e) => setForm((p) => ({ ...p, carga_horaria: e.target.value }))} placeholder="Carga horária" type="number" min={1} />
        </div>
        <button type="submit">Criar curso</button>
      </form>

      {error ? <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0 }}>Carregando...</p> : null}

      <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Código</Th><Th>Nome</Th><Th>Área</Th><Th>Modalidade</Th><Th>Carga</Th><Th>Status</Th><Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.codigo}</Td>
                <Td>{item.nome}</Td>
                <Td>{item.area || "-"}</Td>
                <Td>{item.modalidade}</Td>
                <Td>{item.carga_horaria ?? "-"}</Td>
                <Td>{item.status}</Td>
                <Td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => changeStatus(item.id, "ativo")} disabled={item.status === "ativo"}>
                      Ativar
                    </button>
                    <button type="button" onClick={() => changeStatus(item.id, "inativo")} disabled={item.status === "inativo"}>
                      Inativar
                    </button>
                    <button type="button" onClick={() => removeItem(item.id)}>
                      Apagar
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr><Td colSpan={7}>Sem cursos cadastrados.</Td></tr>
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
