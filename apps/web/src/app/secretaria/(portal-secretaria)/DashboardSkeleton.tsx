"use client";

import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import Link from "next/link";

export default function DashboardSkeleton() {
  const { escolaSlug } = useEscolaId();
  
  return (
    <div role="status" aria-busy="true" aria-label="A carregar painel da Secretaria" className="min-w-0 space-y-6 motion-safe:animate-pulse">
      <span className="sr-only">A carregar painel da Secretaria</span>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div aria-hidden="true" className="h-8 w-48 bg-muted rounded-lg" />
          <div aria-hidden="true" className="h-4 w-32 bg-muted/50 rounded-lg" />
        </div>
        <div aria-hidden="true" className="h-10 w-32 bg-muted rounded-xl" />
      </div>

      <nav className="flex min-w-0 flex-wrap items-center gap-1 rounded-xl bg-card border border-border px-3 py-2">
        {[
          { label: "Início", href: buildPortalHref(escolaSlug, "/secretaria") },
          { label: "Dashboard" }
        ].map((item, i, arr) => (
          <div key={item.label} className="flex items-center gap-1">
            {item.href ? (
              <Link href={item.href} className="text-xs font-medium text-muted-foreground">
                {item.label}
              </Link>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">{item.label}</span>
            )}
            {i < arr.length - 1 && <span className="text-slate-200">/</span>}
          </div>
        ))}
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} aria-hidden="true" className="h-24 bg-card border border-border rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div aria-hidden="true" className="h-64 bg-card border border-border rounded-xl" />
          <div aria-hidden="true" className="h-96 bg-card border border-border rounded-xl" />
        </div>
        <div className="space-y-6">
          <div aria-hidden="true" className="h-48 bg-card border border-border rounded-xl" />
          <div aria-hidden="true" className="h-96 bg-card border border-border rounded-xl" />
        </div>
      </div>
    </div>
  );
}
