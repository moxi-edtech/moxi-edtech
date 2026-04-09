"use client";

import { useEffect, useState } from "react";

type AgendaItem = {
  id: string;
  cohort_id: string;
  formador_user_id: string;
  percentual_honorario: number;
  formacao_cohorts: {
    id: string;
    codigo: string;
    nome: string;
    curso_nome: string;
    data_inicio: string;
    data_fim: string;
    status: string;
    carga_horaria_total: number;
    vagas: number;
  } | null;
};

export default function AgendaClient() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/formacao/agenda", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as
          | { ok: boolean; error?: string; items?: AgendaItem[] }
          | null;
        if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
          throw new Error(json?.error || "Falha ao carregar agenda");
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
      <h1 className="m-0 text-3xl font-bold text-zinc-900">Agenda do Formador</h1>
      <p className="m-0 text-zinc-600">
        Cohorts atribuídos ao formador com período, curso e estado operacional.
      </p>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando...</p> : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <Th>Código</Th>
              <Th>Cohort</Th>
              <Th>Curso</Th>
              <Th>Período</Th>
              <Th>Status</Th>
              <Th>Honorário %</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.formacao_cohorts?.codigo ?? "-"}</Td>
                <Td>{item.formacao_cohorts?.nome ?? "-"}</Td>
                <Td>{item.formacao_cohorts?.curso_nome ?? "-"}</Td>
                <Td>
                  {item.formacao_cohorts?.data_inicio ?? "-"}{" "}
                  {"->"}{" "}
                  {item.formacao_cohorts?.data_fim ?? "-"}
                </Td>
                <Td>{item.formacao_cohorts?.status ?? "-"}</Td>
                <Td>{item.percentual_honorario ?? 0}%</Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <Td colSpan={6}>Nenhuma atribuição encontrada.</Td>
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
