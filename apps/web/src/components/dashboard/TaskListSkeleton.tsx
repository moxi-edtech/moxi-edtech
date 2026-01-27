function TaskItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-100 last:border-0">
      <div className="h-10 w-10 rounded-xl bg-slate-200 shrink-0"></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-40 bg-slate-200 rounded-md"></div>
          <div className="h-4 w-16 bg-slate-200 rounded-md"></div>
        </div>
        <div className="h-4 w-60 bg-slate-200 rounded-md mt-1"></div>
      </div>
      <div className="flex gap-1">
        <div className="h-9 w-9 rounded-lg bg-slate-200"></div>
        <div className="h-9 w-9 rounded-lg bg-slate-200"></div>
      </div>
    </div>
  );
}

export function TaskListSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden animate-pulse">
      <TaskItemSkeleton />
      <TaskItemSkeleton />
      <TaskItemSkeleton />
    </div>
  );
}
