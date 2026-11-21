"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";
import { buildPortalHref } from "@/lib/navigation";
import { filterAndPaginateOperationalRows } from "@/lib/operacoes/operational-table";
import {
  OperationalTableEmptyState,
  OperationalTableErrorState,
  OperationalTableFilterBar,
  OperationalTablePagination,
  OperationalTableSkeleton,
} from "@/components/ui/OperationalTableStates";

type Classe = { id: string; nome: string | null };
const PAGE_SIZE = 10;

/** A list of the classes returned by the school-scoped API, not a global count. */
export default function ClassesListClient() {
  const { escolaId, escolaSlug, isLoading: escolaLoading, error: escolaError } = useEscolaId();
  const pathname = usePathname();
  const classeBase = pathname?.includes("/operacoes/") ? "/operacoes/classes" : "/secretaria/classes";
  const [classes, setClasses] = useState<Classe[]>([]);
  const [loadedSchoolId, setLoadedSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setClasses([]);
    setLoadedSchoolId(null);
    setError(null);
    setPage(1);
    if (!escolaId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const fetchClasses = async () => {
      try {
        const res = await fetch(buildEscolaUrl(escolaId, "/classes"), {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar classes");
        const data = Array.isArray(json.items) ? json.items : Array.isArray(json.data) ? json.data : [];
        if (controller.signal.aborted) return;
        setClasses(data.filter((item: unknown): item is Classe =>
          typeof item === "object" && item !== null && typeof (item as Classe).id === "string"
        ));
        setLoadedSchoolId(escolaId);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar as classes.");
        setLoadedSchoolId(escolaId);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void fetchClasses();
    return () => controller.abort();
  }, [escolaId, retryKey]);

  const pagination = useMemo(() => filterAndPaginateOperationalRows({
    rows: classes,
    search,
    getSearchText: (classe) => classe.nome ?? "",
    page,
    pageSize: PAGE_SIZE,
  }), [classes, search, page]);

  const isPending = escolaLoading || Boolean(escolaId && (loading || loadedSchoolId !== escolaId));
  const displayError = escolaError || (!escolaLoading && !escolaId ? "Escola não identificada." : error);

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-4`}>
      <OperationalTableFilterBar
        label="Pesquisar classes"
        placeholder="Pesquisar pelo nome da classe"
        query={search}
        onQueryChange={(value) => { setSearch(value); setPage(1); }}
      />
      {isPending ? (
        <OperationalTableSkeleton label="A carregar classes" columns={2} rows={5} />
      ) : displayError ? (
        <OperationalTableErrorState
          title="Não foi possível consultar as classes"
          description={String(displayError)}
          onRetry={() => { if (escolaId) setRetryKey((current) => current + 1); else window.location.reload(); }}
        />
      ) : pagination.filteredCount === 0 ? (
        <OperationalTableEmptyState
          title={search ? "Nenhuma classe corresponde à pesquisa." : "Ainda não há classes disponíveis."}
          description={search ? "Experimente outro nome ou limpe a pesquisa." : "As classes configuradas pela escola aparecerão aqui."}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[480px] divide-y divide-border text-left text-sm">
              <caption className="sr-only">Classes disponíveis na escola</caption>
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-6">Classe</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold sm:px-6">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagination.items.map((classe) => (
                  <tr key={classe.id} className="hover:bg-muted/40">
                    <td className="px-4 py-4 font-medium text-foreground sm:px-6">{classe.nome?.trim() || "Classe sem nome"}</td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <Link
                        href={buildPortalHref(escolaSlug || escolaId, `${classeBase}/${classe.id}`)}
                        className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
                      >
                        Ver disciplinas
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <OperationalTablePagination
            page={pagination.currentPage}
            pageSize={PAGE_SIZE}
            total={pagination.filteredCount}
            onPageChange={setPage}
          />
          <p className="text-xs text-muted-foreground">Resultados entre as classes devolvidas pela escola, sem assumir um total global.</p>
        </>
      )}
    </div>
  );
}
