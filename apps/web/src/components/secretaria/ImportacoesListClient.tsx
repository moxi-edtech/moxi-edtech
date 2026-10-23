"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Clock, FileText, RefreshCw, Upload } from "lucide-react";
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
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const [items, setItems] = useState<ImportItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchItems = useCallback(async (options?: { cursor?: string | null; append?: boolean }) => {
    if (options?.append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams();
      params.set("limit", "30");
      if (options?.cursor) params.set("cursor", options.cursor);
      const res = await fetch(`/api/migracao/historico?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar importações");
      const json = (await res.json()) as ImportResponse;
      setNextCursor(json.next_cursor ?? null);
      if (options?.append) {
        setItems((prev) => [...prev, ...(json.items ?? [])]);
      } else {
        setItems(json.items ?? []);
      }
    } catch {
      if (!options?.append) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchItems({ append: false });
  }, [fetchItems]);

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
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-white hover:bg-teal-700"
          >
            <Upload size={18} />
            Nova importação
          </Link>
          <button
            type="button"
            onClick={() => fetchItems({ append: false })}
            className="inline-flex items-center gap-2 rounded-lg bg-card px-4 py-2 text-foreground border border-border hover:bg-muted"
          >
            <RefreshCw size={18} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Arquivo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Registos</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Processado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Carregando importações...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma importação encontrada.
                </td>
              </tr>
            )}
            {!loading && items.map((it) => {
              const counts = [
                `${it.imported_rows ?? 0} importados`,
                `${it.error_rows ?? 0} erros`,
                `${(it.total_rows ?? 0) - (it.imported_rows ?? 0) - (it.error_rows ?? 0)} restantes`,
              ].join(' · ');
              const processed = it.processed_at
                ? new Date(it.processed_at).toLocaleString()
                : it.created_at
                ? new Date(it.created_at).toLocaleString()
                : "—";
              return (
                <tr key={it.id} className="hover:bg-muted/50">
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
                      it.status === 'imported' ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-400' :
                      it.status === 'pending' ? 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400' :
                      it.status === 'failed' ? 'bg-red-500/10 text-red-700 ring-1 ring-red-500/20 dark:text-red-400' :
                      'bg-muted text-muted-foreground ring-1 ring-border'
                    }`}>
                      {it.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{counts}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    <div className="inline-flex items-center gap-1">
                      <Clock size={16} />
                      {processed}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link
                      href={buildContextualPortalHref(escolaParam, `/secretaria/importacoes/${it.id}`, pathname)}
                      className="inline-flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm text-teal-700 border border-teal-500/30 hover:bg-teal-500/10 dark:text-teal-400"
                    >
                      Visualizar
                      <ArrowRight size={16} />
                    </Link>
                    <RowActions id={it.id} currentName={it.file_name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchItems({ cursor: nextCursor, append: true })}
            disabled={loadingMore}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            {loadingMore ? 'Carregando...' : 'Carregar mais'}
          </button>
        </div>
      )}
    </div>
  );
}
