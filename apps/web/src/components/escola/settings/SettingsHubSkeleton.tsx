"use client";

const Pulse = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-slate-200 ${className}`} />
);

export default function SettingsHubSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-8 py-10 space-y-10 bg-slate-50/50 min-h-screen">

      {/* ── 1. PAGE HEADER ───────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <Pulse className="h-3 w-24 mb-2" />
          <Pulse className="h-8 w-52" />
          <Pulse className="h-4 w-72 mt-2" />
        </div>

        {/* Progress widget */}
        <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm min-w-[280px]">
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <Pulse className="h-3 w-28" />
              <Pulse className="h-3 w-8" />
            </div>
            <Pulse className="h-2 w-full rounded-full" />
          </div>
          <Pulse className="w-8 h-8 rounded-xl flex-shrink-0" />
        </div>
      </div>

      {/* ── 2. STATUS BADGES ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Pulse className="h-3 w-12" />
        {["w-24", "w-24", "w-20"].map((w, i) => (
          <Pulse key={i} className={`h-5 ${w} rounded-full`} />
        ))}
      </div>

      {/* ── 3. QUICK CARDS ───────────────────────────────────────────────────── */}
      <div>
        <Pulse className="h-3 w-28 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Highlight card (wizard) */}
          <div className="p-4 rounded-xl border border-[#E3B23C]/30 bg-gradient-to-br from-[#E3B23C]/5 to-white flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <Pulse className="w-9 h-9 rounded-xl" />
              <Pulse className="w-4 h-4 rounded" />
            </div>
            <div className="space-y-1.5">
              <Pulse className="h-4 w-3/4" />
              <Pulse className="h-3 w-full" />
            </div>
            <Pulse className="h-1 w-full rounded-full mt-auto" />
          </div>

          {/* Regular cards */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <Pulse className="w-9 h-9 rounded-xl" />
                <Pulse className="w-4 h-4 rounded" />
              </div>
              <div className="space-y-1.5">
                <Pulse className="h-4 w-2/3" />
                <Pulse className="h-3 w-full" />
                <Pulse className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. CONFIGURATION PANEL ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Pulse className="h-3 w-44" />
          <Pulse className="h-3 w-16" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[560px]">

          {/* Sidebar */}
          <div className="md:w-48 lg:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-100 p-3 space-y-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${i === 0 ? "bg-slate-100" : ""}`}>
                <Pulse className="w-4 h-4 rounded flex-shrink-0" />
                <Pulse className="h-3 w-20 hidden md:block" />
              </div>
            ))}

            {/* Sandbox link at bottom */}
            <div className="hidden md:block pt-3 mt-3 border-t border-slate-100">
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <Pulse className="w-4 h-4 rounded flex-shrink-0" />
                <Pulse className="h-3 w-20" />
              </div>
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 p-6 space-y-4">
            <Pulse className="h-5 w-40" />
            <Pulse className="h-3 w-64" />
            <div className="space-y-3 mt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Pulse key={i} className={`h-10 w-full rounded-xl ${i % 3 === 2 ? "w-3/4" : ""}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. DANGER ZONE (collapsed) ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Pulse className="w-4 h-4 rounded flex-shrink-0" />
            <div className="space-y-1.5">
              <Pulse className="h-3.5 w-28" />
              <Pulse className="h-3 w-44" />
            </div>
          </div>
          <Pulse className="w-4 h-4 rounded" />
        </div>
      </div>

    </div>
  );
}