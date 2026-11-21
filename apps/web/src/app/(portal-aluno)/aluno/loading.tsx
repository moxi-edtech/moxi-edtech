import { KpiCardSkeleton, NoticePanelSkeleton } from "@/components/dashboard";

export default function Loading() {
  return (
    <div role="status" aria-label="A carregar Portal do Aluno" className="space-y-4 sm:space-y-6"><span className="sr-only">A carregar Portal do Aluno</span>
      <div className="space-y-2">
        <div className="h-4 w-32 rounded-xl bg-muted motion-safe:animate-pulse" />
        <div className="h-6 w-44 rounded-xl bg-muted motion-safe:animate-pulse" />
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <KpiCardSkeleton key={`aluno-kpi-${idx}`} />
        ))}
      </div>

      <NoticePanelSkeleton />

      <div className="space-y-2 rounded-xl border border-border bg-card p-4 motion-safe:animate-pulse">
        <div className="h-4 w-32 rounded-xl bg-muted" />
        <div className="h-3 w-full rounded-xl bg-muted" />
        <div className="h-3 w-5/6 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
