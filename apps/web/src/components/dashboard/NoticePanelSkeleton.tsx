function NoticeItemSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="h-5 w-48 bg-slate-200 rounded-md"></div>
        <div className="h-4 w-16 bg-slate-200 rounded-md"></div>
      </div>
      <div className="h-4 w-full bg-slate-200 rounded-md mt-2"></div>
      <div className="h-4 w-3/4 bg-slate-200 rounded-md mt-1"></div>
    </div>
  );
}

export function NoticePanelSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white animate-pulse">
      {showHeader && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <div className="h-8 w-8 rounded-xl bg-slate-200"></div>
          <div className="h-5 w-32 bg-slate-200 rounded-md"></div>
        </div>
      )}

      <div className={`divide-y divide-slate-100 ${showHeader ? "" : "pt-2"}`}>
        <NoticeItemSkeleton />
        <NoticeItemSkeleton />
      </div>
    </div>
  );
}
