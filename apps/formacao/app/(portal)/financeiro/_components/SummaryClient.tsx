"use client";

import { useEffect, useState } from "react";

type Props = {
  endpoint: string;
  emptyLabel: string;
};

export default function SummaryClient({ endpoint, emptyLabel }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        setLoading(true);
        const response = await fetch(endpoint, { cache: "no-store" });
        const json = (await response.json().catch(() => null)) as
          | { ok: boolean; error?: string; summary?: Record<string, number> }
          | null;

        if (!response.ok || !json?.ok || !json.summary) {
          throw new Error(json?.error || "Falha ao carregar resumo");
        }

        if (active) {
          setSummary(json.summary);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [endpoint]);

  if (loading) return <p className="m-0 text-sm text-zinc-700">Carregando resumo...</p>;
  if (error) return <p className="m-0 text-sm text-red-700">{error}</p>;
  if (!summary || Object.keys(summary).length === 0) return <p className="m-0 text-sm text-zinc-700">{emptyLabel}</p>;

  return (
    <div className="grid gap-2">
      {Object.entries(summary).map(([key, value]) => (
        <div key={key} className="flex justify-between text-sm">
          <span className="text-zinc-700">{key}</span>
          <strong>{Number(value).toLocaleString("pt-PT")}</strong>
        </div>
      ))}
    </div>
  );
}
