export default function LoadingPublicLanding() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl animate-pulse px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto h-6 w-44 rounded-full bg-slate-800" />
        <div className="mx-auto mt-8 h-14 w-full max-w-3xl rounded-2xl bg-slate-800" />
        <div className="mx-auto mt-4 h-6 w-full max-w-2xl rounded-xl bg-slate-800" />
        <div className="mx-auto mt-2 h-6 w-2/3 max-w-xl rounded-xl bg-slate-800" />

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
              <div className="h-40 bg-slate-800" />
              <div className="space-y-3 p-6">
                <div className="h-3 w-24 rounded bg-slate-700" />
                <div className="h-6 w-4/5 rounded bg-slate-700" />
                <div className="mt-6 h-4 w-2/3 rounded bg-slate-700" />
                <div className="h-4 w-3/5 rounded bg-slate-700" />
                <div className="h-4 w-1/2 rounded bg-slate-700" />
                <div className="mt-6 h-10 w-full rounded-2xl bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

