"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type PortalNavLinkProps = {
  href: string;
  label: string;
  icon?: ReactNode;
  variant?: "sidebar" | "drawer" | "bottom";
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PortalNavLink({
  href,
  label,
  icon,
  variant = "sidebar",
}: PortalNavLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  if (variant === "drawer") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 ${
          active
            ? "border-[#1F6B3B]/40 bg-[#1F6B3B]/20 text-white shadow-sm"
            : "border-slate-800 text-slate-200 hover:bg-slate-900"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  }

  if (variant === "bottom") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`rounded-xl px-2 py-2 text-center text-xs font-semibold transition-all duration-200 ${
          active
            ? "bg-emerald-100 text-emerald-900"
            : "text-zinc-700 hover:bg-zinc-100"
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
        active
          ? "bg-[#1F6B3B]/10 text-white ring-1 ring-[#1F6B3B]/30"
          : "text-slate-300 hover:bg-slate-900/70 hover:text-white"
      }`}
    >
      {icon}
      <span className="truncate font-medium">{label}</span>
    </Link>
  );
}
