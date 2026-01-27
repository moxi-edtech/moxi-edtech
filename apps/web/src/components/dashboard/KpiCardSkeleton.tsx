export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 h-24 flex flex-col justify-between animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-4 w-20 bg-slate-200 rounded-md"></div>
        <div className="h-9 w-9 bg-slate-200 rounded-xl"></div>
      </div>
      <div className="h-8 w-12 bg-slate-200 rounded-md"></div>
    </div>
  );
}
