// apps/web/src/components/layout/klasse/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { 
  ChevronDown, 
  ChevronLeft, 
  HelpCircle,
  LayoutDashboard,
  HeartPulse,
  Activity,
  Building2,
  Users,
  User,
  GraduationCap,
  Megaphone,
  CalendarClock,
  BarChart,
  FileText,
  Settings2,
  Lock,
  KeyRound,
  BookOpen,
  CalendarDays,
  Archive,
  History,
  UsersRound,
  Wallet,
  Layers,
  BadgeDollarSign
} from "lucide-react";
import type { NavItem } from "@/lib/sidebarNav";

// Mapa estático de ícones para performance máxima e estabilidade de build
const ICON_MAP: Record<string, any> = {
  LayoutDashboard,
  HeartPulse,
  Activity,
  Building2,
  Users,
  User,
  GraduationCap,
  Megaphone,
  CalendarClock,
  BarChart,
  FileText,
  Settings2,
  Lock,
  KeyRound,
  BookOpen,
  CalendarDays,
  Archive,
  History,
  UsersRound,
  Wallet,
  Layers,
  BadgeDollarSign
};

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function Sidebar({
  items,
  escolaNome,
  planoNome,
  portalTitle,
}: {
  items: NavItem[];
  escolaNome?: string | null;
  planoNome?: string | null;
  portalTitle?: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const sidebarItems = useMemo(() => {
    return items.map((it) => {
      const children = it.children ?? [];
      const childActive = children.some(
        (child) => pathname === child.href || pathname?.startsWith(child.href + "/")
      );
      const active = pathname === it.href || pathname?.startsWith(it.href + "/") || childActive;
      return { ...it, active, childActive, children };
    });
  }, [pathname, items]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sidebarItems.forEach((it) => {
      if (it.children.length) initial[it.href] = it.active;
    });
    return initial;
  });

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      sidebarItems.forEach((it) => {
        if (it.children.length && it.active) {
          next[it.href] = true;
        }
      });
      return next;
    });
  }, [sidebarItems]);

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 z-40 border-r border-slate-800/80 bg-slate-950 text-slate-100 flex flex-col",
        "transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] overflow-x-hidden"
      )}
      style={
        {
          width: collapsed ? "80px" : "256px",
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
            <div className="min-w-0 animate-in fade-in duration-500">
              <div className="font-semibold tracking-tight leading-5">KLASSE</div>
              <div className="text-xs text-slate-400 font-medium">gestão escolar</div>
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
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {sidebarItems.map((it) => {
            const Icon = ICON_MAP[it.icon] ?? HelpCircle;
            const hasChildren = it.children.length > 0;
            const isExpanded = expanded[it.href];

            return (
              <li key={it.href}>
                <div className="flex items-center gap-2">
                  <Link
                    href={it.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm flex-1",
                      "transition-all duration-200",
                      it.active
                        ? "bg-[#1F6B3B]/10 text-white ring-1 ring-[#1F6B3B]/30"
                        : "text-slate-300 hover:bg-slate-900/70 hover:text-white"
                    )}
                    title={collapsed ? it.label : undefined}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        it.active ? "text-[#E3B23C]" : "text-slate-500 group-hover:text-[#E3B23C]"
                      )}
                    />
                    {!collapsed && <span className="truncate font-medium">{it.label}</span>}

                    {it.badge && !collapsed && (
                      <span className="ml-auto rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 ring-1 ring-rose-500/20">
                        {it.badge}
                      </span>
                    )}
                  </Link>

                  {!collapsed && hasChildren && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [it.href]: !prev[it.href] }))
                      }
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                        it.active ? "text-[#E3B23C]" : "text-slate-500 hover:text-[#E3B23C] hover:bg-slate-900"
                      )}
                      aria-label={isExpanded ? "Recolher" : "Expandir"}
                    >
                      <ChevronDown
                        className={cn("h-4 w-4 transition-transform duration-300", isExpanded && "rotate-180")}
                      />
                    </button>
                  )}
                </div>

                {!collapsed && hasChildren && isExpanded && (
                  <ul className="mt-1 space-y-1 pl-11 animate-in slide-in-from-left-2 duration-300">
                    {it.children.map((child) => {
                      const childActive =
                        pathname === child.href || pathname?.startsWith(child.href + "/");
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors",
                              childActive
                                ? "bg-slate-900 text-white font-bold"
                                : "text-slate-400 hover:bg-slate-900/60 hover:text-white"
                            )}
                          >
                            <span className={cn(
                              "h-1 w-1 rounded-full transition-colors",
                              childActive ? "bg-[#E3B23C]" : "bg-slate-700"
                            )} />
                            <span className="truncate">{child.label}</span>
                            {child.badge && (
                              <span className="ml-auto rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-400">
                                {child.badge}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="mt-auto p-3 border-t border-slate-800/80">
        <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2", "bg-slate-900/40 border border-white/5")}>
          <div className="h-9 w-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[10px] font-black text-slate-400">
            AO
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold truncate text-slate-200">
                {escolaNome || portalTitle || "Klasse Network"}
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">
                {planoNome || portalTitle || "SaaS Hub"}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
