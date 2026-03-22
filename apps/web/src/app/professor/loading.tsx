export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-5 sm:p-6 space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <div className="h-5 w-44 rounded-md bg-slate-200 animate-pulse" />
        <div className="h-3 w-56 rounded-md bg-slate-200 animate-pulse" />
      </div>

      <div className="rounded-2xl border border-emerald-950/30 bg-gradient-to-br from-[#0d1f12] via-[#12321d] to-[#1f4028] p-4 sm:p-5 shadow-sm">
        <div className="h-3 w-32 rounded-full bg-white/20 animate-pulse" />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-5 w-40 rounded-full bg-white/20 animate-pulse" />
            <div className="h-3 w-48 rounded-full bg-white/20 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`professor-kpi-${idx}`} className="rounded-xl bg-white/10 px-3 py-2 text-center">
                <div className="h-3 w-20 rounded-full bg-white/20 mx-auto animate-pulse" />
                <div className="mt-2 h-5 w-12 rounded-full bg-white/20 mx-auto animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 sm:gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded-md bg-slate-200 animate-pulse" />
            <div className="h-3 w-24 rounded-md bg-slate-200 animate-pulse" />
          </div>
          <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`professor-turma-${idx}`} className="rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="h-4 w-28 rounded-md bg-slate-200 animate-pulse" />
                <div className="h-3 w-36 rounded-md bg-slate-200 animate-pulse" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded-md bg-slate-200 animate-pulse" />
            <div className="h-3 w-20 rounded-md bg-slate-200 animate-pulse" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`professor-agenda-${idx}`} className="space-y-2">
                <div className="h-3 w-20 rounded-md bg-slate-200 animate-pulse" />
                <div className="rounded-lg border border-slate-200 px-3 py-2 space-y-1">
                  <div className="h-3 w-28 rounded-md bg-slate-200 animate-pulse" />
                  <div className="h-3 w-36 rounded-md bg-slate-200 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
