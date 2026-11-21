import * as React from "react";
import { AlertCircle, SearchX, X } from "lucide-react";

/** Presentation-only normalization. Server pages must not be inferred from a partial batch. */
export function getOperationalPaginationState(page: number, pageSize: number, total: number) {
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.trunc(pageSize)) : 1;
  const count = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
  const pageCount = Math.max(1, Math.ceil(count / size));
  const requested = Number.isFinite(page) ? Math.trunc(page) : 1;
  const current = Math.min(pageCount, Math.max(1, requested));
  return {
    pageCount,
    current,
    count,
    start: count === 0 ? 0 : (current - 1) * size + 1,
    end: Math.min(count, current * size),
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  };
}

export function OperationalTableSkeleton({
  label = "A carregar tabela",
  columns = 8,
  rows = 5,
}: {
  label?: string;
  columns?: number;
  rows?: number;
}) {
  const safeColumns = Number.isFinite(columns) ? Math.max(1, Math.min(16, Math.trunc(columns))) : 8;
  const safeRows = Number.isFinite(rows) ? Math.max(1, Math.min(12, Math.trunc(rows))) : 5;
  return (
    <div role="status" aria-label={label} aria-busy="true" className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <span className="sr-only">{label}</span>
      <table aria-hidden="true" className="min-w-[840px] w-full text-left text-sm">
        <thead className="bg-muted/50">
          <tr>
            {Array.from({ length: safeColumns }, (_, col) => (
              <th key={col} className="px-4 py-3"><span className="block h-3 w-20 rounded-full bg-muted motion-safe:animate-pulse" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: safeRows }, (_, row) => (
            <tr key={row} className="border-t border-border">
              {Array.from({ length: safeColumns }, (_, col) => (
                <td key={col} className="px-4 py-4">
                  <span className="block h-3 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const paginationButtonClass = "min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:cursor-not-allowed disabled:opacity-50";

export function OperationalTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  disabled?: boolean;
}) {
  const { current, pageCount, count, start, end, hasPrevious, hasNext } = getOperationalPaginationState(page, pageSize, total);
  return (
    <nav aria-label="Paginação da tabela" className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground" aria-live="polite">{start}–{end} de {count} resultados</p>
      <div className="flex items-center gap-2">
        <button type="button" disabled={disabled || !hasPrevious} onClick={() => onPageChange(current - 1)} className={paginationButtonClass}>Anterior</button>
        <span aria-current="page" className="min-w-16 text-center text-xs font-medium text-muted-foreground">{current} / {pageCount}</span>
        <button type="button" disabled={disabled || !hasNext} onClick={() => onPageChange(current + 1)} className={paginationButtonClass}>Seguinte</button>
      </div>
    </nav>
  );
}

/** Cursor-based APIs may expose hasMore but cannot claim a global total. */
export function OperationalCursorPagination({
  page,
  visibleCount,
  hasMore,
  onPageChange,
  disabled = false,
}: {
  page: number;
  visibleCount: number;
  hasMore: boolean;
  onPageChange: (nextPage: number) => void;
  disabled?: boolean;
}) {
  const current = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const visible = Number.isFinite(visibleCount) ? Math.max(0, Math.trunc(visibleCount)) : 0;
  return (
    <nav aria-label="Paginação da tabela" className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground" aria-live="polite">Página {current} · {visible} {visible === 1 ? "registo" : "registos"} nesta página</p>
      <div className="flex items-center gap-2">
        <button type="button" disabled={disabled || current <= 1} onClick={() => onPageChange(current - 1)} className={paginationButtonClass}>Anterior</button>
        <button type="button" disabled={disabled || !hasMore} onClick={() => onPageChange(current + 1)} className={paginationButtonClass}>Seguinte</button>
      </div>
    </nav>
  );
}

export function OperationalTableFilterBar({
  query,
  onQueryChange,
  label,
  placeholder,
  children,
  activeFilters = 0,
  onClearFilters,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  label: string;
  placeholder: string;
  children?: React.ReactNode;
  activeFilters?: number;
  onClearFilters?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="search" className="relative min-w-0 flex-1 sm:max-w-lg">
          <input
            type="search"
            aria-label={label}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-4 pr-11 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
          />
          {query.length > 0 && <button type="button" aria-label="Limpar pesquisa" onClick={() => onQueryChange("")} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"><X size={16} aria-hidden="true" /></button>}
        </div>
        {onClearFilters && activeFilters > 0 && <button type="button" onClick={onClearFilters} className="min-h-11 shrink-0 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20">Limpar filtros ({activeFilters})</button>}
      </div>
      {children && <div className="flex min-w-0 flex-wrap items-end gap-3">{children}</div>}
    </div>
  );
}

export function OperationalTableEmptyState({ title, description, action }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div role="status" className="flex min-w-0 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <SearchX className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function OperationalTableErrorState({ title = "Não foi possível carregar os resultados", description, onRetry }: {
  title?: string;
  description?: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-card p-4 text-sm shadow-sm sm:p-5">
      <div className="flex items-center gap-2 font-semibold text-foreground"><AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />{title}</div>
      {description && <p className="text-muted-foreground">{description}</p>}
      <button type="button" onClick={onRetry} className={paginationButtonClass}>Tentar novamente</button>
    </div>
  );
}
