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
    <div className="grid gap-4">
      <h1 className="m-0 text-3xl font-bold text-zinc-900">Backoffice • Cohorts</h1>

      <form onSubmit={submit} className="grid gap-2 rounded-xl border border-zinc-200 p-3">
        <strong>Novo cohort</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="Código" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.curso_nome} onChange={(e) => setForm((p) => ({ ...p, curso_nome: e.target.value }))} placeholder="Curso" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.carga_horaria_total} onChange={(e) => setForm((p) => ({ ...p, carga_horaria_total: e.target.value }))} placeholder="Carga horária" type="number" min={1} />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.vagas} onChange={(e) => setForm((p) => ({ ...p, vagas: e.target.value }))} placeholder="Vagas" type="number" min={1} />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.data_inicio} onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))} type="date" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.data_fim} onChange={(e) => setForm((p) => ({ ...p, data_fim: e.target.value }))} type="date" />
          <select className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="planeada">planeada</option>
            <option value="em_andamento">em_andamento</option>
            <option value="concluida">concluida</option>
            <option value="cancelada">cancelada</option>
          </select>
        </div>
        <button type="submit" className="w-fit rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">Criar cohort</button>
      </form>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50">
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
                  <div className="flex flex-wrap gap-1.5">
                    {(["planeada", "em_andamento", "concluida", "cancelada"] as const).map((status) => (
                      <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50" key={status} type="button" onClick={() => changeStatus(item.id, status)} disabled={item.status === status}>
                        {status}
                      </button>
                    ))}
                    <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => removeItem(item.id)}>
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
  return <th className="border-b border-zinc-200 px-2.5 py-2 text-left font-medium text-zinc-700">{children}</th>;
}
function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className="border-b border-zinc-200 px-2.5 py-2 text-zinc-800">{children}</td>;
}
