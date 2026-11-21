"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Clock, FileText, RefreshCw, Upload } from "lucide-react";
import { OperationalTableErrorState } from "@/components/ui/OperationalTableStates";
import { formatDateTime } from "@/lib/formatters";
import RowActions from "@/app/secretaria/(portal-secretaria)/importacoes/RowActions";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildContextualPortalHref } from "@/lib/navigation";

type ImportItem = {
  id: string;
  escola_id: string;
  file_name: string | null;
  status: string | null;
  total_rows: number | null;
  imported_rows: number | null;
  error_rows: number | null;
  processed_at: string | null;
  created_at: string | null;
};

type ImportResponse = {
  items: ImportItem[];
  next_cursor?: string | null;
};

export default function ImportacoesListClient() {
  const pathname = usePathname();
  const { escolaId, escolaSlug, isLoading: escolaLoading } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const [items, setItems] = useState<ImportItem[]>([]);
  const [loadedSchoolId, setLoadedSchoolId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const fetchItems = useCallback(async (options?: { cursor?: string | null; append?: boolean }) => {
    requestRef.current?.abort();
    if (!escolaId) {
      setItems([]);
      setNextCursor(null);
      setLoadedSchoolId(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    const append = options?.append === true;
    setError(null);
    setLoadingMore(append);
    setLoading(!append);
    if (!append) {
      setItems([]);
      setNextCursor(null);
    }
    try {
      const params = new URLSearchParams({ limit: "30", escola_id: escolaId });
      if (options?.cursor) params.set("cursor", options.cursor);
      const res = await fetch(`/api/migracao/historico?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as (ImportResponse & { error?: string }) | null;
      if (!res.ok || !Array.isArray(json?.items)) {
        throw new Error(json?.error || "Falha ao carregar importações.");
      }
      if (append && options?.cursor && json.next_cursor === options.cursor) {
        throw new Error("A paginação não avançou. Atualize a listagem.");
      }
      if (controller.signal.aborted) return;
      setNextCursor(json.next_cursor ?? null);
      setLoadedSchoolId(escolaId);
      setItems((prev) => append
        ? Array.from(new Map([...prev, ...json.items].map((item) => [item.id, item])).values())
        : json.items);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Falha ao carregar importações.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [escolaId]);

  useEffect(() => {
    void fetchItems({ append: false });
    return () => requestRef.current?.abort();
  }, [fetchItems, escolaId]);

  const schoolReady = !escolaLoading && Boolean(escolaId) && loadedSchoolId === escolaId;
  const visibleItems = schoolReady ? items : [];
  const visibleCursor = schoolReady ? nextCursor : null;
  const isLoading = escolaLoading || Boolean(escolaId && !schoolReady) || loading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Importações recentes</h1>
          <p className="text-sm text-muted-foreground">Últimas importações efetuadas nesta escola.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={buildContextualPortalHref(escolaParam, "/secretaria/migracao/alunos", pathname)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
          >
            <Upload size={18} />
            Nova importação
          </Link>
          <button
            type="button"
            onClick={() => fetchItems({ append: false })}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
          >
            <RefreshCw size={18} />
            Atualizar
          </button>
        </div>
      </div>

      {!escolaLoading && !escolaId && <OperationalTableErrorState description="Escola não identificada." onRetry={() => window.location.reload()} />}
      {schoolReady && error && <OperationalTableErrorState description={error} onRetry={() => void fetchItems({ append: false })} />}

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {visibleItems.length} {visibleItems.length === 1 ? "importação carregada" : "importações carregadas"}{visibleCursor ? " · Existem mais registos para carregar" : ""}. Esta contagem não representa necessariamente o total da escola.
      </p>

      <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Arquivo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Registos</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Processado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Carregando importações...
                </td>
              </tr>
            )}
            {!isLoading && schoolReady && !error && visibleItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma importação encontrada.
                </td>
              </tr>
            )}
            {!isLoading && schoolReady && visibleItems.map((it) => {
              const restantes = (it.total_rows ?? 0) - (it.imported_rows ?? 0) - (it.error_rows ?? 0);
              const counts = [
                `${it.imported_rows ?? 0} importados`,
                `${it.error_rows ?? 0} erros`,
                restantes < 0 ? "Contagens inconsistentes" : `${restantes} restantes`,
              ].join(" · ");
              const processed = formatDateTime(it.processed_at ?? it.created_at);
              return (
                <tr key={it.id} className="hover:bg-muted/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium text-foreground truncate max-w-[360px]">
                          {it.file_name ?? it.id}
                        </div>
                        <div className="text-xs text-muted-foreground">ID: {it.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      it.status === 'imported' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                      it.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
                      it.status === 'failed' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' :
                      'bg-muted text-foreground ring-1 ring-border'
                    }`}>
                      {it.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{counts}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <div className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock size={16} />
                      {processed}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={`${buildContextualPortalHref(escolaParam, `/secretaria/importacoes/${it.id}`, pathname)}?escola_id=${encodeURIComponent(escolaId!)}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm text-teal-700 border border-teal-200 hover:bg-teal-50"
                    >
                      Visualizar
                      <ArrowRight size={16} />
                    </Link>
                    <RowActions id={it.id} escolaId={it.escola_id} currentName={it.file_name} onChanged={() => void fetchItems({ append: false })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibleCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchItems({ cursor: visibleCursor, append: true })}
            disabled={loadingMore || loading}
            className="min-h-11 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-60"
          >
            {loadingMore ? 'Carregando...' : 'Carregar mais'}
          </button>
        </div>
      )}
    </div>
  );
}
