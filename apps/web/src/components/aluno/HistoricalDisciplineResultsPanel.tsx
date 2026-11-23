"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

type HistoricalDiscipline = {
  id: string;
  disciplina_nome: string | null;
  nota_final: number | string | null;
  resultado: string | null;
};
type HistoricalResult = {
  ok?: boolean;
  error?: string;
  ano?: number;
  fonte?: string;
  total?: number;
  page?: number;
  page_size?: number;
  items?: HistoricalDiscipline[];
};

function gradeLabel(value: HistoricalDiscipline["nota_final"]): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("pt-PT", { maximumFractionDigits: 2 })
    : "—";
}

export function HistoricalDisciplineResultsPanel({
  alunoId,
  year,
  escolaId,
}: {
  alunoId: string;
  year: number;
  escolaId?: string | null;
}) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<HistoricalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setResult(null);
    setError("");
    const params = new URLSearchParams({ ano: String(year), page: String(page) });
    if (escolaId) params.set("escola_id", escolaId);

    void fetch(`/api/secretaria/alunos/${encodeURIComponent(alunoId)}/historico-disciplinas?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = await response.json().catch(() => ({})) as HistoricalResult;
        if (!response.ok || !json.ok || json.ano !== year || json.page !== page || json.fonte !== "historico_disciplinas") {
          throw new Error(json.error || "Não foi possível confirmar os resultados deste ano.");
        }
        return json;
      })
      .then((json) => { if (!controller.signal.aborted) setResult(json); })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Falha ao consultar as disciplinas.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [alunoId, escolaId, year, page, retry]);

  const rows = result?.ano === year && result?.page === page ? (result.items ?? []) : [];
  const total = result?.total ?? 0;
  const size = result?.page_size ?? 25;
  const pageCount = Math.max(1, Math.ceil(total / size));

  return (
    <section aria-label="Disciplinas do histórico anual" className="mt-4 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Resultados finais documentados</h3>
        {!loading && !error && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {total} {total === 1 ? "disciplina" : "disciplinas"}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Registos da fonte oficial do ano {year}/{year + 1}. Não são notas trimestrais e não substituem uma pauta emitida.
      </p>
      {loading && <p className="mt-3 text-sm text-muted-foreground" role="status">A consultar resultados documentados…</p>}
      {!loading && error && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((previous) => previous + 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground">
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      )}
      {!loading && !error && total === 0 && (
        <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          Não existem resultados oficiais por disciplina registados neste ano. Consulte a Reconciliação Histórica se houver pendências.
        </p>
      )}
      {!loading && !error && total > 0 && (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="pb-2 pr-3 font-medium">Disciplina</th>
                  <th scope="col" className="pb-2 pr-3 font-medium">Nota final</th>
                  <th scope="col" className="pb-2 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-3 font-medium text-foreground">{row.disciplina_nome || "Disciplina sem nome documentado"}</td>
                    <td className="py-2 pr-3 tabular-nums text-foreground">{gradeLabel(row.nota_final)}</td>
                    <td className="py-2 text-muted-foreground">{row.resultado || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > size && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>Página {page} de {pageCount}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronLeft size={14} /> Anterior
                </button>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">
                  Seguinte <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
