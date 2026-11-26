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
  UserPlus,
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
import { SIDEBAR_WIDTH, SIDEBAR_LABEL, SIDEBAR_NAV, SIDEBAR_ROW, SIDEBAR_SUBROW, sidebarLabel } from "@/lib/sidebarPresentation";

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
        "h-dvh sticky top-0 z-40 shrink-0 max-w-[65vw] md:max-w-none border-r border-klasse-gold/15 bg-klasse-dark text-slate-100 flex flex-col",
        "transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] overflow-x-hidden"
      )}
      style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
      aria-label="Navegação lateral"
      data-sidebar="klasse"
      data-collapsed={collapsed}
    >
      {/* Header / Brand */}
      <div className={cn("flex shrink-0 min-w-0 items-center gap-2 border-b border-klasse-gold/15 px-3 py-3", collapsed ? "flex-col justify-center" : "justify-between")}>
        <Link href={homeHref} className="flex items-center gap-2 min-w-0" aria-label="Ir para a home do portal">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-amber/15 ring-1 ring-amber/30 flex items-center justify-center">
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
              <div className="truncate font-semibold tracking-tight leading-5">KLASSE</div>
              <div className="truncate text-xs text-slate-400 font-medium">gestão escolar</div>
            </div>
          )}
        </Link>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            "hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-amber/20"
          )}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          aria-expanded={!collapsed}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Nav */}
      <nav className={cn(SIDEBAR_NAV, "px-2 py-3")} aria-label="Menus do portal">
        <ul className="space-y-1">
          {sidebarItems.map((it) => {
            const Icon = ICON_MAP[it.icon] ?? HelpCircle;
            const hasChildren = it.children.length > 0;
            const isExpanded = expanded[it.href];

            return (
              <li key={it.href}>
                <div className="flex min-w-0 items-center">
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
                      SIDEBAR_ROW, "group", collapsed && "justify-center",
                      "transition-all duration-200",
                      it.active
                        ? "bg-klasse-gold/10 text-klasse-gold ring-1 ring-klasse-gold/25"
                        : "text-slate-300 hover:bg-slate-900/70 hover:text-white"
                    )}
                    title={it.label}
                      aria-label={it.label}
                    aria-expanded={!collapsed && Boolean(isExpanded)}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        it.active ? "text-klasse-gold" : "text-white/55 group-hover:text-klasse-gold"
                      )}
                    />
                    {!collapsed && <span className={cn(SIDEBAR_LABEL, "font-medium")}>{sidebarLabel(it.label)}</span>}

                    {it.badge && !collapsed && (
                      <span className="ml-auto shrink-0 max-w-[4rem] truncate rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 ring-1 ring-rose-500/20">
                        {it.badge}
                      </span>
                    )}
                    {!collapsed && (
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 transition-transform duration-300", isExpanded && "rotate-180")}
                      />
                    )}
                  </button>
                  ) : (
                    <Link
                      href={it.href}
                      className={cn(
                        SIDEBAR_ROW, "group", collapsed && "justify-center",
                        "transition-all duration-200",
                        it.active
                          ? "bg-klasse-gold/10 text-klasse-gold ring-1 ring-klasse-gold/25"
                          : "text-slate-300 hover:bg-slate-900/70 hover:text-white"
                      )}
                      title={it.label}
                      aria-label={it.label}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          it.active ? "text-klasse-gold" : "text-white/55 group-hover:text-klasse-gold"
                        )}
                      />
                      {!collapsed && <span className={cn(SIDEBAR_LABEL, "font-medium")}>{sidebarLabel(it.label)}</span>}
                      {it.badge && !collapsed && (
                        <span className="ml-auto shrink-0 max-w-[4rem] truncate rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 ring-1 ring-rose-500/20">
                          {it.badge}
                        </span>
                      )}
                    </Link>
                  )}
                </div>

                {!collapsed && hasChildren && isExpanded && (
                  <ul className="mt-1 min-w-0 space-y-1 pl-6 animate-in fade-in duration-200">
                    {it.children.map((child) => {
                      const childActive =
                        pathname === child.href || pathname?.startsWith(child.href + "/");
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            title={child.label}
                            aria-label={child.label}
                            aria-current={childActive ? "page" : undefined}
                            className={cn(
                              SIDEBAR_SUBROW, "transition-colors",
                              childActive
                                ? "bg-klasse-gold/10 text-klasse-gold font-bold"
                                : "text-slate-400 hover:bg-slate-900/60 hover:text-white"
                            )}
                          >
                            <span className={cn(
                              "h-1 w-1 shrink-0 rounded-full transition-colors",
                              childActive ? "bg-klasse-gold" : "bg-klasse-gold/20"
                            )} />
                            <span className={SIDEBAR_LABEL}>{sidebarLabel(child.label)}</span>
                            {child.badge && (
                              <span className="ml-auto shrink-0 max-w-[4rem] truncate rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-400">
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
      <div className="mt-auto shrink-0 min-w-0 p-2 border-t border-klasse-gold/15">
        <div className={cn("flex min-w-0 items-center gap-2 rounded-xl px-2 py-2", collapsed && "justify-center", "bg-slate-900/40 border border-white/5")}>
          <div className="h-9 w-9 shrink-0 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[10px] font-black text-slate-400">
            AO
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold truncate text-slate-200" title={escolaNome || portalTitle || "Klasse Network"}>
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
