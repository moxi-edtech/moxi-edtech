"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarContext } from "./SidebarContext";
import * as Icons from "lucide-react";
import { SIDEBAR_LABEL, SIDEBAR_NAV, SIDEBAR_ROW, sidebarLabel } from "@/lib/sidebarPresentation";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: string;
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { collapsed } = useSidebarContext();

  return (
    <nav className={`${SIDEBAR_NAV} space-y-1 px-2 py-3`}>
      {items.map((item) => {
        const Icon = (Icons as any)[item.icon] || Icons.HelpCircle;
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`
              ${SIDEBAR_ROW} relative font-medium transition-colors
              ${isActive ? "bg-slate-900 text-klasse-gold ring-1 ring-klasse-gold/25" : "text-slate-400 hover:bg-slate-900 hover:text-klasse-gold"}
              ${collapsed ? "justify-center" : ""}
            `}
          >
            <Icon size={20} className="shrink-0" />

            {!collapsed && <span className={SIDEBAR_LABEL}>{sidebarLabel(item.label)}</span>}

            {item.badge && !collapsed && (
              <span className="ml-auto shrink-0 max-w-[4rem] truncate rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                {item.badge}
              </span>
            )}

            {item.badge && collapsed && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
