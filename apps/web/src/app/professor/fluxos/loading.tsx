export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-5 sm:p-6 space-y-4">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded-md bg-slate-200 animate-pulse" />
          <div className="h-3 w-56 rounded-md bg-slate-200 animate-pulse" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 animate-pulse space-y-3">
          <div className="h-4 w-32 rounded-md bg-slate-200" />
          <div className="h-40 sm:h-56 rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
