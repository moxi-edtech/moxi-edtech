"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileWarning, Loader2, RefreshCw } from "lucide-react";

type Preview = {
  ok: true; ano: 2025; total: number; elegiveis: number;
  sincronizadas: number; documento_ano_divergente: number;
  historico_aberto: number; inconsistencias: number;
};

export function CurtumeNotasFinaisStatus({ escola }: { escola: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [revision, setRevision] = useState(0);
  const requestSeq = useRef(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const seq = ++requestSeq.current;
    setLoading(true); setError("");
    const url = `/api/secretaria/operacoes-academicas/notas-finais-2025/status?escola=${encodeURIComponent(escola)}`;
    void (async () => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          if (seq === requestSeq.current) setForbidden(true);
          return;
        }
        const result: Partial<Preview> & { error?: string } = await response.json();
        if (!response.ok || result.ok !== true) {
          throw new Error(result.error || "Não foi possível verificar as notas finais.");
        }
        if (seq === requestSeq.current) {
          setPreview(result as Preview);
          setForbidden(false);
        }
      } catch (cause) {
        if (!controller.signal.aborted && seq === requestSeq.current) {
          setError(cause instanceof Error ? cause.message : "Falha na consulta.");
        }
      } finally {
        if (!controller.signal.aborted && seq === requestSeq.current) setLoading(false);
      }
    })();
    return () => { controller.abort(); requestSeq.current += 1; };
  }, [escola, revision]);

  if (forbidden) return null;
  return (
    <section aria-label="Notas finais históricas 2025/2026"
      className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-sora text-sm font-semibold text-emerald">Notas finais · 2025/2026</h2>
          <p className="text-xs text-muted-foreground">
            Estado das notas documentais já vinculadas às notas operacionais, sem criar avaliações trimestrais.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
        </button>
      </div>
      {loading && !preview && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A verificar as notas finais…
        </p>
      )}
      {preview && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Sincronizadas", count: preview.sincronizadas },
              { label: "Conferir ano da pauta", count: preview.documento_ano_divergente },
              { label: "Históricos por fechar", count: preview.historico_aberto },
              { label: "Outras pendências", count: preview.inconsistencias },
            ].map((item) => (
              <div className="rounded-xl border border-border bg-background p-3" key={item.label}>
                <span className="block font-sora text-xl font-semibold tabular-nums">{item.count.toLocaleString("pt-AO")}</span>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground" role="status">
            {preview.elegiveis === 0
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald" aria-hidden="true" />
              : <FileWarning className="h-4 w-4 shrink-0 text-amber" aria-hidden="true" />}
            <p>
              {preview.elegiveis === 0
                ? "Todas as notas finais elegíveis já estão sincronizadas. As restantes exigem conferência documental ou fecho académico na Reconciliação Histórica."
                : `${preview.elegiveis} notas finais podem ser sincronizadas após a validação técnica da operação. Os históricos ainda abertos e as pautas divergentes não são alterados automaticamente.`}
            </p>
          </div>
        </>
      )}
      {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}
      {loading && preview && <p className="mt-2 text-xs text-muted-foreground" role="status">A atualizar contagens…</p>}
    </section>
  );
}
