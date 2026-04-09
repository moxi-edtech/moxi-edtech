"use client";

import { useEffect, useState } from "react";

type CursoItem = {
  id: string;
  descricao: string;
  valor_total: number;
  status_pagamento: string;
  referencia: string | null;
  emissao_em: string | null;
  vencimento_em: string | null;
  cohort: {
    id: string;
    codigo: string;
    nome: string;
    curso_nome: string;
    data_inicio: string;
    data_fim: string;
    status: string;
  } | null;
};

export default function MeusCursosClient() {
  const [items, setItems] = useState<CursoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/formacao/meus-cursos", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as
          | { ok: boolean; error?: string; items?: CursoItem[] }
          | null;
        if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
          throw new Error(json?.error || "Falha ao carregar cursos");
        }
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
    <div className="grid gap-3.5">
      <h1 className="m-0 text-3xl font-bold text-zinc-900">Meus Cursos</h1>
      <p className="m-0 text-zinc-600">
        Cursos vinculados ao formando por inscrições/cobranças com estado de pagamento.
      </p>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <Th>Curso</Th>
              <Th>Cohort</Th>
              <Th>Período</Th>
              <Th>Referência</Th>
              <Th>Valor</Th>
              <Th>Pagamento</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.cohort?.curso_nome ?? item.descricao}</Td>
                <Td>{item.cohort?.nome ?? "-"}</Td>
                <Td>
                  {item.cohort?.data_inicio ?? "-"} {"->"} {item.cohort?.data_fim ?? "-"}
                </Td>
                <Td>{item.referencia ?? "-"}</Td>
                <Td>{item.valor_total}</Td>
                <Td>{item.status_pagamento}</Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <Td colSpan={6}>Nenhum curso ativo encontrado.</Td>
              </tr>
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
