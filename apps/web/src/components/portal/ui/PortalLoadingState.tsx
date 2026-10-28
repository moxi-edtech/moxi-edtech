/** Quiet, accessible loading state. Skeleton shapes are not read by assistive tech. */
export function PortalLoadingState({
  label = "A carregar dados",
  rows = 2,
  className = "",
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={`min-w-0 space-y-2 ${className}`}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-2 motion-safe:animate-pulse">
        {Array.from({ length: Math.max(1, Math.min(rows, 6)) }, (_, index) => (
          <div key={index} className="h-16 rounded-xl border border-border bg-muted/50" />
        ))}
      </div>
    </div>
  );
}
