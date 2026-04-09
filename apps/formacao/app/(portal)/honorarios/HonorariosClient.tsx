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
    <div className="grid gap-3.5">
      <h1 className="m-0 text-3xl font-bold text-zinc-900">Honorários</h1>

      <form onSubmit={createItem} className="grid gap-2 rounded-xl border border-zinc-200 p-3">
        <strong>Novo lançamento</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.cohort_id} onChange={(e) => setForm((p) => ({ ...p, cohort_id: e.target.value }))} placeholder="Cohort ID" required />
          {role === "formador" ? null : (
            <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.formador_user_id} onChange={(e) => setForm((p) => ({ ...p, formador_user_id: e.target.value }))} placeholder="Formador user_id" required />
          )}
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.horas_ministradas} onChange={(e) => setForm((p) => ({ ...p, horas_ministradas: e.target.value }))} placeholder="Horas" type="number" min={1} required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.valor_hora} onChange={(e) => setForm((p) => ({ ...p, valor_hora: e.target.value }))} placeholder="Valor/hora" type="number" min={0} step="0.01" required />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.bonus} onChange={(e) => setForm((p) => ({ ...p, bonus: e.target.value }))} placeholder="Bônus" type="number" min={0} step="0.01" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.desconto} onChange={(e) => setForm((p) => ({ ...p, desconto: e.target.value }))} placeholder="Desconto" type="number" min={0} step="0.01" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.competencia} onChange={(e) => setForm((p) => ({ ...p, competencia: e.target.value }))} type="date" required />
        </div>
        <button type="submit" className="w-fit rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">Lançar honorário</button>
      </form>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50">
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
                  <div className="flex flex-wrap gap-1.5">
                    {(["aberto", "aprovado", "pago", "cancelado"] as const).map((status) => (
                      <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50" key={status} type="button" onClick={() => changeStatus(item.id, status)} disabled={item.status === status}>
                        {status}
                      </button>
                    ))}
                    <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => removeItem(item.id)}>Apagar</button>
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
  return <th className="border-b border-zinc-200 px-2.5 py-2 text-left font-medium text-zinc-700">{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className="border-b border-zinc-200 px-2.5 py-2 text-zinc-800">{children}</td>;
}
