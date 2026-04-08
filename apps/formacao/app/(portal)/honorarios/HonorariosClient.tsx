"use client";

import { FormEvent, useEffect, useState } from "react";

type Item = {
  id: string;
  referencia: string;
  cohort_id: string;
  formador_user_id: string;
  horas_ministradas: number;
  valor_hora: number;
  bonus: number;
  desconto: number;
  valor_liquido: number;
  competencia: string;
  status: "aberto" | "aprovado" | "pago" | "cancelado";
};

type Props = { role: string; userId: string };

export default function HonorariosClient({ role, userId }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    cohort_id: "",
    formador_user_id: role === "formador" ? userId : "",
    horas_ministradas: "",
    valor_hora: "",
    bonus: "0",
    desconto: "0",
    competencia: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/formacao/honorarios", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; items?: Item[] } | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) throw new Error(json?.error || "Falha ao carregar honorários");
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
      cohort_id: form.cohort_id,
      formador_user_id: role === "formador" ? userId : form.formador_user_id,
      horas_ministradas: Number(form.horas_ministradas),
      valor_hora: Number(form.valor_hora),
      bonus: Number(form.bonus || "0"),
      desconto: Number(form.desconto || "0"),
      competencia: form.competencia,
    };

    const res = await fetch("/api/formacao/honorarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao criar lançamento");
      return;
    }

    setForm({
      cohort_id: "",
      formador_user_id: role === "formador" ? userId : "",
      horas_ministradas: "",
      valor_hora: "",
      bonus: "0",
      desconto: "0",
      competencia: "",
    });
    await load();
  };

  const changeStatus = async (id: string, status: Item["status"]) => {
    setError(null);
    const res = await fetch("/api/formacao/honorarios", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao atualizar status");
      return;
    }
    await load();
  };

  const removeItem = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/formacao/honorarios?id=${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao remover lançamento");
      return;
    }
    await load();
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0 }}>Honorários</h1>

      <form onSubmit={createItem} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
        <strong>Novo lançamento</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
          <input value={form.cohort_id} onChange={(e) => setForm((p) => ({ ...p, cohort_id: e.target.value }))} placeholder="Cohort ID" required />
          {role === "formador" ? null : (
            <input value={form.formador_user_id} onChange={(e) => setForm((p) => ({ ...p, formador_user_id: e.target.value }))} placeholder="Formador user_id" required />
          )}
          <input value={form.horas_ministradas} onChange={(e) => setForm((p) => ({ ...p, horas_ministradas: e.target.value }))} placeholder="Horas" type="number" min={1} required />
          <input value={form.valor_hora} onChange={(e) => setForm((p) => ({ ...p, valor_hora: e.target.value }))} placeholder="Valor/hora" type="number" min={0} step="0.01" required />
          <input value={form.bonus} onChange={(e) => setForm((p) => ({ ...p, bonus: e.target.value }))} placeholder="Bônus" type="number" min={0} step="0.01" />
          <input value={form.desconto} onChange={(e) => setForm((p) => ({ ...p, desconto: e.target.value }))} placeholder="Desconto" type="number" min={0} step="0.01" />
          <input value={form.competencia} onChange={(e) => setForm((p) => ({ ...p, competencia: e.target.value }))} type="date" required />
        </div>
        <button type="submit">Lançar honorário</button>
      </form>

      {error ? <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0 }}>Carregando...</p> : null}

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Ref</Th><Th>Cohort</Th><Th>Formador</Th><Th>Competência</Th><Th>Valor Líquido</Th><Th>Status</Th><Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.referencia}</Td>
                <Td>{item.cohort_id}</Td>
                <Td>{item.formador_user_id}</Td>
                <Td>{item.competencia}</Td>
                <Td>{item.valor_liquido}</Td>
                <Td>{item.status}</Td>
                <Td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(["aberto", "aprovado", "pago", "cancelado"] as const).map((status) => (
                      <button key={status} type="button" onClick={() => changeStatus(item.id, status)} disabled={item.status === status}>
                        {status}
                      </button>
                    ))}
                    <button type="button" onClick={() => removeItem(item.id)}>Apagar</button>
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr><Td colSpan={7}>Sem lançamentos.</Td></tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>{children}</td>;
}
