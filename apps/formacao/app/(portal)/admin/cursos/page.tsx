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
    <div className="grid gap-4">
      <h1 className="m-0 text-3xl font-bold text-zinc-900">Backoffice • Cursos</h1>

      <form onSubmit={submit} className="grid gap-2 rounded-xl border border-zinc-200 p-3">
        <strong>Novo curso</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="Código" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))} placeholder="Área" />
          <select className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.modalidade} onChange={(e) => setForm((p) => ({ ...p, modalidade: e.target.value }))}>
            <option value="presencial">presencial</option>
            <option value="online">online</option>
            <option value="hibrido">hibrido</option>
          </select>
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={form.carga_horaria} onChange={(e) => setForm((p) => ({ ...p, carga_horaria: e.target.value }))} placeholder="Carga horária" type="number" min={1} />
        </div>
        <button type="submit" className="w-fit rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">Criar curso</button>
      </form>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50">
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
                  <div className="flex flex-wrap gap-1.5">
                    <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => changeStatus(item.id, "ativo")} disabled={item.status === "ativo"}>
                      Ativar
                    </button>
                    <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => changeStatus(item.id, "inativo")} disabled={item.status === "inativo"}>
                      Inativar
                    </button>
                    <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => removeItem(item.id)}>
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
  return <th className="border-b border-zinc-200 px-2.5 py-2 text-left font-medium text-zinc-700">{children}</th>;
}
function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className="border-b border-zinc-200 px-2.5 py-2 text-zinc-800">{children}</td>;
}
