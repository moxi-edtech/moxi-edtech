export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-5 sm:p-6 space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <div className="h-5 w-40 rounded-md bg-slate-200 animate-pulse" />
        <div className="h-3 w-56 rounded-md bg-slate-200 animate-pulse" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3 animate-pulse">
            <div className="h-4 w-32 rounded-md bg-slate-200" />
            <div className="h-9 w-full rounded-xl bg-slate-100" />
            <div className="h-9 w-full rounded-xl bg-slate-100" />
            <div className="h-9 w-full rounded-xl bg-slate-100" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-2 animate-pulse">
            <div className="h-4 w-24 rounded-md bg-slate-200" />
            <div className="h-3 w-40 rounded-md bg-slate-200" />
            <div className="h-3 w-32 rounded-md bg-slate-200" />
          </div>
          <div className="h-10 w-full rounded-xl bg-klasse-gold/20 animate-pulse" />
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3 animate-pulse">
          <div className="h-4 w-32 rounded-md bg-slate-200" />
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={`frequencias-row-${idx}`} className="flex items-center justify-between">
              <div className="h-3 w-32 rounded-md bg-slate-200" />
              <div className="h-3 w-24 rounded-md bg-slate-200" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
