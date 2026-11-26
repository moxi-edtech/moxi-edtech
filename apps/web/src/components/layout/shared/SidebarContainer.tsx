"use client";

import { PropsWithChildren } from "react";
import { useSidebar } from "./useSidebar"; // O teu hook atual
import { SidebarProvider } from "./SidebarContext"; // O ficheiro acima
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { SIDEBAR_WIDTH } from "@/lib/sidebarPresentation";

type Props = PropsWithChildren<{
  storageKey: string;
  cssVar?: string;
  collapsedWidth?: string;
  expandedWidth?: string;
  className?: string;
}>;

export default function SidebarContainer({
  storageKey,
  cssVar = "--sidebar-w",
  collapsedWidth = SIDEBAR_WIDTH.collapsed,
  expandedWidth = SIDEBAR_WIDTH.expanded,
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
    <SidebarProvider value={{ collapsed, toggle }}>
      <aside
        className={clsx(
          "klasse-sidebar-theme group/sidebar fixed top-0 z-40 h-dvh shrink-0 transition-[width] duration-300 ease-in-out",
          "bg-sidebar border-r border-sidebar-border text-white shadow-xl", // Estilo MoxiNexa Dark
          className,
        )}
        style={{ width: collapsed ? collapsedWidth : expandedWidth }}
      >
        {/* Botão de Toggle Flutuante */}
        <button
          onClick={toggle}
          type="button"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          aria-expanded={!collapsed}
          className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-klasse-green transition-colors hidden md:flex"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Conteúdo Interno */}
        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          {children}
        </div>
      </aside>
    </SidebarProvider>
  );
}