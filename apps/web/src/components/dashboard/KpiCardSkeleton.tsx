export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 h-24 flex flex-col justify-between animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-4 w-20 bg-muted-foreground/15 rounded-md"></div>
        <div className="h-9 w-9 bg-muted-foreground/15 rounded-xl"></div>
      </div>
      <div className="h-8 w-12 bg-muted-foreground/15 rounded-md"></div>
    </div>
  );
}
