// apps/web/src/components/layout/klasse/Sidebar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
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
  BarChart3,
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
  BadgeDollarSign,
  AlertTriangle,
  ShieldCheck,
  Landmark,
  ClipboardList,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/sidebarNav";

// Mapa estático de ícones para performance máxima e estabilidade de build
const ICON_MAP: Record<string, LucideIcon> = {
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
  BarChart3,
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
  BadgeDollarSign,
  AlertTriangle,
  ShieldCheck,
  Landmark,
  ClipboardList,
  MessageSquare,
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
      const activePrefixes = [it.href, ...(it.activePrefixes ?? [])];
      const matchesPath = (href: string) =>
        pathname === href || pathname?.startsWith(href + "/");
      const childActive = children.some(
        (child) => matchesPath(child.href)
      );
      const active = activePrefixes.some(matchesPath) || childActive;
      return { ...it, active, childActive, children };
    });
  }, [pathname, items]);
  const homeHref = sidebarItems[0]?.href || "/";

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
        "h-screen sticky top-0 z-40 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col",
        "transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] overflow-x-hidden"
      )}
      style={{ width: collapsed ? "80px" : "clamp(208px, 16vw, 256px)" }}
    >
      {/* Header / Brand */}
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-4 min-[1700px]:px-4">
        <Link href={homeHref} className="flex items-center gap-3 min-w-0" aria-label="Ir para a home do portal">
          <div className="h-10 w-10 rounded-xl bg-amber/15 ring-1 ring-amber/30 flex items-center justify-center">
            <Image
              src="/logo-klasse-ui.png"
              alt="KLASSE"
              width={22}
              height={22}
              className="h-5 w-5 object-contain"
            />
          </div>

          {!collapsed && (
            <div className="min-w-0 animate-in fade-in duration-500">
              <div className="font-semibold tracking-tight leading-5 text-sidebar-foreground">KLASSE</div>
              <div className="text-xs text-muted-foreground font-medium">gestão escolar</div>
            </div>
          )}
        </Link>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground",
            "hover:bg-sidebar-accent focus:outline-none focus:ring-4 focus:ring-amber/20"
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
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => {
                        setExpanded((prev) => ({
                          ...prev,
                          [it.href]: collapsed ? true : !prev[it.href],
                        }));
                        if (collapsed) setCollapsed(false);
                      }}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm flex-1",
                        "transition-all duration-200",
                        it.active
                          ? "bg-[#1F6B3B]/10 text-sidebar-foreground ring-1 ring-[#1F6B3B]/30"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                      title={collapsed ? it.label : undefined}
                      aria-expanded={Boolean(isExpanded)}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          it.active ? "text-[#E3B23C]" : "text-muted-foreground group-hover:text-[#E3B23C]"
                        )}
                      />
                      {!collapsed && <span className="truncate font-medium">{it.label}</span>}

                      {it.badge && !collapsed && (
                        <span className="ml-auto rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-500 ring-1 ring-rose-500/20">
                          {it.badge}
                        </span>
                      )}
                      {!collapsed && (
                        <ChevronDown
                          className={cn("ml-auto h-4 w-4 transition-transform duration-300", isExpanded && "rotate-180")}
                        />
                      )}
                    </button>
                  ) : (
                    <Link
                      href={it.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm flex-1",
                        "transition-all duration-200",
                        it.active
                          ? "bg-[#1F6B3B]/10 text-sidebar-foreground ring-1 ring-[#1F6B3B]/30"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                      title={collapsed ? it.label : undefined}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          it.active ? "text-[#E3B23C]" : "text-muted-foreground group-hover:text-[#E3B23C]"
                        )}
                      />
                      {!collapsed && <span className="truncate font-medium">{it.label}</span>}
                      {it.badge && !collapsed && (
                        <span className="ml-auto rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-500 ring-1 ring-rose-500/20">
                          {it.badge}
                        </span>
                      )}
                    </Link>
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
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold"
                                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <span className={cn(
                              "h-1 w-1 rounded-full transition-colors",
                              childActive ? "bg-[#E3B23C]" : "bg-muted-foreground/40"
                            )} />
                            <span className="truncate">{child.label}</span>
                            {child.badge && (
                              <span className="ml-auto rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-500">
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
      <div className="mt-auto p-3 border-t border-sidebar-border">
        <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2", "bg-sidebar-accent/50 border border-sidebar-border")}>
          <div className="h-9 w-9 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-[10px] font-black text-muted-foreground">
            AO
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold truncate text-sidebar-foreground">
                {escolaNome || portalTitle || "Klasse Network"}
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate">
                {planoNome || portalTitle || "SaaS Hub"}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
