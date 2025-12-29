"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import * as Icons from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof Icons; // ✅ string válida do lucide
  badge?: string;
};

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const sidebarItems = useMemo(() => {
    return items.map((it) => ({
      ...it,
      active: pathname === it.href || pathname?.startsWith(it.href + "/"),
    }));
  }, [pathname, items]);

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 z-40 border-r border-slate-800/80 bg-slate-950 text-slate-100",
        "transition-[width] duration-200 ease-out"
      )}
      style={
        {
          width: collapsed ? "var(--sidebar-collapsed, 80px)" : "var(--sidebar-expanded, 256px)",
        } as any
      }
    >
      {/* Header / Brand */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/80">
        <Link href="/app" className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-klasse-gold/15 ring-1 ring-klasse-gold/30 flex items-center justify-center">
            <span className="text-klasse-gold font-semibold">K</span>
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold tracking-tight leading-5">KLASSE</div>
              <div className="text-xs text-slate-400">gestão escolar</div>
            </div>
          )}
        </Link>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg",
            "hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
          )}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Nav */}
      <nav className="px-2 py-3">
        <ul className="space-y-1">
          {sidebarItems.map((it) => {
            const Icon = (Icons as any)[it.icon] ?? Icons.HelpCircle;

            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                    "transition-colors",
                    it.active
                      ? "bg-slate-900 text-white ring-1 ring-klasse-gold/25"
                      : "text-slate-200 hover:bg-slate-900/70 hover:text-white"
                  )}
                  title={collapsed ? it.label : undefined}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      it.active ? "text-klasse-gold" : "text-slate-400 group-hover:text-klasse-gold"
                    )}
                  />
                  {!collapsed && <span className="truncate">{it.label}</span>}

                  {it.badge && !collapsed && (
                    <span className="ml-auto rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                      {it.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800/80">
        <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2", "bg-slate-900/40")}>
          <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-xs">
            AO
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">Escola</div>
              <div className="text-xs text-slate-400 truncate">Admin</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}