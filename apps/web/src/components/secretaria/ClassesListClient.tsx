"use client";

import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";
import { buildPortalHref } from "@/lib/navigation";
import { OperationalTableEmptyState, OperationalTableErrorState, OperationalTableSkeleton } from "@/components/ui/OperationalTableStates";

type Classe = { id: string; nome: string | null };
type ClassesResponse = { ok?: boolean; data?: Classe[]; items?: Classe[]; next_cursor?: string | null; error?: string };

/** The API returns up to 50 classes per cursor, not the whole school's classes. */
export default function ClassesListClient() {
  const { escolaId, escolaSlug, isLoading: escolaLoading, error: escolaError } = useEscolaId();
  const pathname = usePathname();
  const classeBase = pathname?.includes("/operacoes/") ? "/operacoes/classes" : "/secretaria/classes";
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [loadedSchoolId, setLoadedSchoolId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchClasses = useCallback(async (cursor?: string | null) => {
    if (!escolaId) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const append = Boolean(cursor);
    setLoading(!append);
    setLoadingMore(append);
    setError(null);
    if (!append) { setClasses([]); setNextCursor(null); setLoadedSchoolId(null); }
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(buildEscolaUrl(escolaId, "/classes", params), { cache: "no-store", signal: controller.signal });
      const json = (await res.json().catch(() => null)) as ClassesResponse | null;
      const batch = Array.isArray(json?.data) ? json.data : json?.items;
      if (!res.ok || json?.ok !== true || !Array.isArray(batch)) {
        throw new Error(json?.error || "Falha ao carregar classes.");
      }
      if (cursor && json.next_cursor === cursor) throw new Error("A paginação não avançou. Atualize a listagem.");
      if (controller.signal.aborted) return;
      const validatedBatch: Classe[] = batch.filter((item): item is Classe => Boolean(item && typeof item.id === "string"))
        .map((item) => ({ id: item.id, nome: typeof item.nome === "string" ? item.nome : null }));
      setClasses((prev) => append
        ? Array.from(new Map([...prev, ...validatedBatch].map((item) => [item.id, item])).values())
        : validatedBatch);
      setLoadedSchoolId(escolaId);
      setNextCursor(json.next_cursor ?? null);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Falha ao carregar classes.");
        setLoadedSchoolId(escolaId);
      }
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setLoadingMore(false); }
    }
  }, [escolaId]);

  useEffect(() => {
    if (!escolaId) {
      controllerRef.current?.abort();
      setClasses([]);
      setNextCursor(null);
      setLoadedSchoolId(null);
      if (!escolaLoading) setLoading(false);
      return;
    }
    void fetchClasses();
    return () => controllerRef.current?.abort();
  }, [escolaId, escolaLoading, fetchClasses]);

  const isPending = loading || escolaLoading || Boolean(escolaId && loadedSchoolId !== escolaId);

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-6`}>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-klasse-green"><BookOpen className="h-5 w-5" aria-hidden="true" />Classes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Consulte as classes registadas na escola.</p>
      </div>

      {isPending ? <OperationalTableSkeleton label="A carregar classes" columns={2} rows={5} /> : null}
      {!isPending && (error || escolaError || !escolaId) && (
        <OperationalTableErrorState description={error || escolaError || "Escola não identificada."} onRetry={() => void fetchClasses()} />
      )}
      {!isPending && !error && !escolaError && escolaId && classes.length === 0 && (
        <OperationalTableEmptyState title="Nenhuma classe encontrada" description="Não existem classes registadas nesta escola." />
      )}

      {!isPending && !error && !escolaError && escolaId && loadedSchoolId === escolaId && classes.length > 0 && (
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[420px] divide-y divide-border text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase">Nome</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {classes.map((classe) => (
                <tr key={classe.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium text-foreground">{classe.nome?.trim() || "Classe sem nome"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={buildPortalHref(escolaSlug || escolaId, `${classeBase}/${classe.id}`)} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-klasse-green hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20">Ver disciplinas</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span aria-live="polite">{classes.length} classes carregadas{nextCursor ? " · Existem mais classes" : ""}. Não é uma contagem global da escola.</span>
            {nextCursor && (
              <button
                type="button"
                disabled={loading || loadingMore || Boolean(error)}
                onClick={() => void fetchClasses(nextCursor)}
                className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50"
              >
                {loadingMore ? "A carregar…" : "Carregar mais"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
