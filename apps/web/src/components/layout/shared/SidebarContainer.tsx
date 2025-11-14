"use client";

import { PropsWithChildren } from "react";
import { useSidebar } from "./useSidebar";
import clsx from "clsx";

type Props = PropsWithChildren<{
  storageKey: string;         // ex: "super-admin:sidebar"
  cssVar?: string;            // default: --sidebar-w
  collapsedWidth?: string;
  expandedWidth?: string;
  className?: string;
}>;

export default function SidebarContainer({
  storageKey,
  cssVar = "--sidebar-w",
  collapsedWidth = "80px",
  expandedWidth = "256px",
  className,
  children,
}: Props) {
  const { collapsed, toggle } = useSidebar({
    storageKey,
    cssVar,
    collapsedWidth,
    expandedWidth,
  });

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 md:relative z-40 h-screen md:h-auto bg-gradient-to-br from-teal-500 to-sky-600 text-white shadow-xl transition-[width] duration-200",
        className
      )}
      style={{ width: `var(${cssVar}, ${expandedWidth})` }}
      data-collapsed={collapsed ? "1" : "0"}
    >
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Expandir" : "Recolher"}
        className="absolute right-2 top-2 rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
      >
        {collapsed ? "»" : "«"}
      </button>

      {children}
    </aside>
  );
}
