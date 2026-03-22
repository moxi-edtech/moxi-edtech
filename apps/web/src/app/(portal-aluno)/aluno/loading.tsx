import { KpiCardSkeleton, NoticePanelSkeleton } from "@/components/dashboard";

export default function Loading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded-md bg-slate-200 animate-pulse" />
        <div className="h-6 w-44 rounded-md bg-slate-200 animate-pulse" />
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <KpiCardSkeleton key={`aluno-kpi-${idx}`} />
        ))}
      </div>

      <NoticePanelSkeleton />

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 animate-pulse">
        <div className="h-4 w-32 rounded-md bg-slate-200" />
        <div className="h-3 w-full rounded-md bg-slate-200" />
        <div className="h-3 w-5/6 rounded-md bg-slate-200" />
      </div>
    </div>
  );
}
