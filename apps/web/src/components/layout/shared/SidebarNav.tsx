"use client";

import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UsersIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  LifebuoyIcon,
  BuildingLibraryIcon,
  BanknotesIcon,
  BoltIcon,
  EnvelopeIcon,
  AcademicCapIcon,
  MegaphoneIcon,
  BellAlertIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

// Map of icon name -> component. Allows passing serializable strings from Server Components.
const ICONS = {
  HomeIcon,
  UsersIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  LifebuoyIcon,
  BuildingLibraryIcon,
  BanknotesIcon,
  BoltIcon,
  EnvelopeIcon,
  AcademicCapIcon,
  MegaphoneIcon,
  BellAlertIcon,
  ArrowDownTrayIcon,
};

export type NavItem = {
  label: string;
  href: string;
  // Icon is passed as a string key that maps to ICONS
  icon?: keyof typeof ICONS | string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="mt-2 space-y-1">
      {items.map((it) => {
        const Icon = it.icon ? ICONS[it.icon as keyof typeof ICONS] : undefined;
        const isActive = typeof it.active === 'boolean'
          ? it.active
          : Boolean(pathname && (pathname === it.href || pathname.startsWith(it.href + "/")));
        const content = (
          <div
            className={clsx(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition",
              it.disabled
                ? "opacity-60 cursor-not-allowed"
                : isActive
                ? "bg-white/20 shadow-sm border-l-4 border-white"
                : "hover:bg-white/10"
            )}
          >
            {Icon && <Icon className="w-5 h-5" />}
            <span className="truncate sidebar-text">{it.label}</span>
            {it.badge && (
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/20 sidebar-text">
                {it.badge}
              </span>
            )}
          </div>
        );
        return it.disabled ? (
          <div key={it.label} title="Indisponível">{content}</div>
        ) : (
          <Link key={it.label} href={it.href}>{content}</Link>
        );
      })}
    </nav>
  );
}
