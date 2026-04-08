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

  if (loading) return <p style={{ margin: 0 }}>Carregando resumo...</p>;
  if (error) return <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p>;
  if (!summary || Object.keys(summary).length === 0) return <p style={{ margin: 0 }}>{emptyLabel}</p>;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {Object.entries(summary).map(([key, value]) => (
        <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span>{key}</span>
          <strong>{Number(value).toLocaleString("pt-PT")}</strong>
        </div>
      ))}
    </div>
  );
}
