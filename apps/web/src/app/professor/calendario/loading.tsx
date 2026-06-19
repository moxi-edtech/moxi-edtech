export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-5 sm:p-6">
        <div className="space-y-2">
          <div className="h-5 w-44 animate-pulse rounded-md bg-slate-200" />
          <div className="h-3 w-72 animate-pulse rounded-md bg-slate-200" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="h-60 animate-pulse rounded-[2rem] border border-slate-200 bg-white" />
          <div className="h-60 animate-pulse rounded-[2rem] border border-slate-200 bg-white" />
        </div>
        <div className="h-80 animate-pulse rounded-[2rem] border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
