"use client";

import { PropsWithChildren } from "react";
import { useSidebar } from "./useSidebar"; // O teu hook atual
import { SidebarProvider } from "./SidebarContext"; // O ficheiro acima
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

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
    <SidebarProvider value={{ collapsed, toggle }}>
      <aside
        className={clsx(
          "group/sidebar sticky top-0 z-40 h-screen transition-[width] duration-300 ease-in-out",
          "bg-slate-900 border-r border-slate-800 text-white shadow-xl", // Estilo MoxiNexa Dark
          className,
        )}
        style={{ width: collapsed ? collapsedWidth : expandedWidth }}
      >
        {/* Botão de Toggle Flutuante */}
        <button
          onClick={toggle}
          className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-teal-600 transition-colors hidden md:flex"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Conteúdo Interno */}
        <div className="flex h-full flex-col overflow-hidden">
          {children}
        </div>
      </aside>
    </SidebarProvider>
  );
}