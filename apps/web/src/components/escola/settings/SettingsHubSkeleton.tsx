"use client";

export default function SettingsHubSkeleton() {
  const SkeletonCard = ({ highlight = false }: { highlight?: boolean }) => (
    <div
      className={`
        group relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-full
        ${highlight
          ? "bg-gradient-to-br from-[#E3B23C]/5 to-white border-[#E3B23C]/30"
          : "bg-white border-slate-200"
        }
      `}
    >
      <div>
        <div className="flex justify-between items-start mb-3">
          <div className="p-2.5 rounded-xl bg-slate-200 animate-pulse w-10 h-10"></div>
          <div className="px-2.5 py-1 rounded-full border bg-slate-200 animate-pulse w-20 h-5"></div>
        </div>
        <div className="h-4 bg-slate-200 rounded-md mb-1 w-3/4 animate-pulse"></div>
        <div className="h-3 bg-slate-200 rounded-md w-full animate-pulse"></div>
        <div className="h-3 bg-slate-200 rounded-md w-2/3 animate-pulse mt-1"></div>
      </div>
      {highlight && (
        <div className="mt-4">
          <div className="h-1.5 w-full bg-slate-200 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto p-8 space-y-10 bg-slate-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-3 w-28 bg-slate-200 rounded-md animate-pulse mb-2"></div>
          <div className="h-8 w-72 bg-slate-200 rounded-md animate-pulse"></div>
          <div className="h-4 w-56 bg-slate-200 rounded-md animate-pulse mt-2"></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="h-5 w-40 bg-slate-200 rounded-md animate-pulse"></div>
            <div className="h-3 w-56 bg-slate-200 rounded-md animate-pulse mt-2"></div>
          </div>
          <div className="h-10 w-40 bg-slate-200 rounded-xl animate-pulse"></div>
        </div>

        <div className="px-8 py-4 border-b border-slate-100">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`tab-${idx}`} className="h-8 w-24 bg-slate-200 rounded-full animate-pulse"></div>
            ))}
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
              <div className="h-4 w-28 bg-slate-200 rounded-md animate-pulse mb-2"></div>
              <div className="h-3 w-40 bg-slate-200 rounded-md animate-pulse mb-6"></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={`metric-${idx}`} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="h-3 w-16 bg-slate-200 rounded-md animate-pulse mb-2"></div>
                    <div className="h-6 w-14 bg-slate-200 rounded-md animate-pulse"></div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={`pill-${idx}`} className="h-6 w-20 bg-slate-200 rounded-full animate-pulse"></div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-fit">
              <div className="mb-4">
                <div className="h-4 w-28 bg-slate-200 rounded-md animate-pulse mb-2"></div>
                <div className="h-3 w-48 bg-slate-200 rounded-md animate-pulse"></div>
              </div>
              <div className="mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between mb-2">
                  <div className="h-3 w-12 bg-slate-200 rounded-md animate-pulse"></div>
                  <div className="h-3 w-10 bg-slate-200 rounded-md animate-pulse"></div>
                </div>
                <div className="h-2 bg-slate-200 rounded-full animate-pulse"></div>
              </div>
              <div className="space-y-3">
                <div className="h-10 bg-slate-200 rounded-xl animate-pulse"></div>
                <div className="h-10 bg-slate-200 rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950 p-4">
            <div className="rounded-lg bg-white p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="h-3 w-24 bg-slate-200 rounded-md animate-pulse mb-2"></div>
                  <div className="h-4 w-32 bg-slate-200 rounded-md animate-pulse"></div>
                </div>
                <div className="h-3 w-24 bg-slate-200 rounded-md animate-pulse"></div>
              </div>
              <div className="h-80 bg-slate-200 rounded-xl animate-pulse"></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-fit">
            <div className="mb-4">
              <div className="h-4 w-28 bg-slate-200 rounded-md animate-pulse mb-2"></div>
              <div className="h-3 w-48 bg-slate-200 rounded-md animate-pulse"></div>
            </div>
            <div className="mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between mb-2">
                <div className="h-3 w-12 bg-slate-200 rounded-md animate-pulse"></div>
                <div className="h-3 w-10 bg-slate-200 rounded-md animate-pulse"></div>
              </div>
              <div className="h-2 bg-slate-200 rounded-full animate-pulse"></div>
            </div>
            <div className="space-y-3">
              <div className="h-10 bg-slate-200 rounded-xl animate-pulse"></div>
              <div className="h-10 bg-slate-200 rounded-xl animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <div className="h-4 w-40 bg-slate-200 rounded-md animate-pulse mb-4 ml-1"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            <SkeletonCard highlight />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>

        <div>
          <div className="h-4 w-44 bg-slate-200 rounded-md animate-pulse mb-4 ml-1"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <SkeletonCard key={`admin-${idx}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
