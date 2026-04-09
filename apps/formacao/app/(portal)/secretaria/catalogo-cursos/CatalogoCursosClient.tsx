"use client";

import { useEffect, useState } from "react";

type Curso = {
  id: string;
  codigo: string;
  nome: string;
  area: string | null;
  modalidade: "presencial" | "online" | "hibrido";
  carga_horaria: number | null;
  status: "ativo" | "inativo";
};

export default function CatalogoCursosClient() {
  const [items, setItems] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/formacao/backoffice/cursos", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; items?: Curso[] } | null;
        if (!res.ok || !json?.ok || !Array.isArray(json.items)) throw new Error(json?.error || "Falha ao carregar catálogo");
        setItems(json.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <div className="grid gap-4">
      <header>
        <p className="m-0 text-xs uppercase tracking-wider text-zinc-500">
          Secretaria Centro
        </p>
        <h1 className="mt-1.5 text-3xl font-bold text-zinc-900">Catálogo de Cursos</h1>
      </header>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <Th>Código</Th>
              <Th>Curso</Th>
              <Th>Área</Th>
              <Th>Modalidade</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.codigo}</Td>
                <Td>{item.nome}</Td>
                <Td>{item.area || "-"}</Td>
                <Td>{item.modalidade}</Td>
                <Td>{item.status}</Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <Td colSpan={5}>Sem cursos cadastrados.</Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-zinc-200 px-3 py-2.5 text-left font-medium text-zinc-700">{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className="border-b border-zinc-200 px-3 py-2.5 text-zinc-800">
      {children}
    </td>
  );
}
