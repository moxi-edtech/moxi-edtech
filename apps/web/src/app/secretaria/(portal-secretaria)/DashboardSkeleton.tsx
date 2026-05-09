"use client";

import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import Link from "next/link";

export default function DashboardSkeleton() {
  const { escolaSlug } = useEscolaId();
  
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-100 rounded-lg" />
          <div className="h-4 w-32 bg-slate-50 rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-slate-100 rounded-xl" />
      </div>

      <nav className="flex items-center gap-1 rounded-xl bg-white border border-slate-100 px-3 py-2">
        {[
          { label: "Início", href: buildPortalHref(escolaSlug, "/secretaria") },
          { label: "Dashboard" }
        ].map((item, i, arr) => (
          <div key={item.label} className="flex items-center gap-1">
            {item.href ? (
              <Link href={item.href} className="text-xs font-medium text-slate-400">
                {item.label}
              </Link>
            ) : (
              <span className="text-xs font-bold text-slate-600">{item.label}</span>
            )}
            {i < arr.length - 1 && <span className="text-slate-200">/</span>}
          </div>
        ))}
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-white border border-slate-100 rounded-2xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-64 bg-white border border-slate-100 rounded-2xl" />
          <div className="h-96 bg-white border border-slate-100 rounded-2xl" />
        </div>
        <div className="space-y-6">
          <div className="h-48 bg-white border border-slate-100 rounded-2xl" />
          <div className="h-96 bg-white border border-slate-100 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
