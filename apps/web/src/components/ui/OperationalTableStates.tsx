import * as React from "react";

export function OperationalTableSkeleton({
  label = "A carregar tabela",
  columns = 8,
  rows = 5,
}: {
  label?: string;
  columns?: number;
  rows?: number;
}) {
  const safeColumns = Math.max(1, Math.min(16, Math.trunc(columns) || 8));
  const safeRows = Math.max(1, Math.min(12, Math.trunc(rows) || 5));
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

export function OperationalTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
}) {
  const size = Math.max(1, Math.trunc(pageSize) || 1);
  const count = Math.max(0, Math.trunc(total) || 0);
  const pageCount = Math.max(1, Math.ceil(count / size));
  const current = Math.min(pageCount, Math.max(1, Math.trunc(page) || 1));
  const start = count === 0 ? 0 : (current - 1) * size + 1;
  const end = Math.min(count, current * size);
  return (
    <nav aria-label="Paginação da tabela" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground" aria-live="polite">{start}–{end} de {count} resultados</p>
      <div className="flex items-center gap-2">
        <button type="button" disabled={current <= 1} onClick={() => onPageChange(current - 1)} className="min-h-10 rounded-xl border border-border bg-card px-4 font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">Anterior</button>
        <span className="min-w-16 text-center text-xs font-medium text-muted-foreground">{current} / {pageCount}</span>
        <button type="button" disabled={current >= pageCount} onClick={() => onPageChange(current + 1)} className="min-h-10 rounded-xl border border-border bg-card px-4 font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">Seguinte</button>
      </div>
    </nav>
  );
}
