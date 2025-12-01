"use client";

import { useSidebarContext } from "./SidebarContext";
import { School } from "lucide-react";

export function SidebarHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { collapsed } = useSidebarContext();

  return (
    <div className={`flex h-16 items-center border-b border-white/10 px-4 transition-all ${collapsed ? 'justify-center' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-white shadow-lg shadow-teal-500/20">
          <School size={18} />
        </div>
        
        {/* Esconde texto suavemente quando colapsado */}
        <div className={`overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <h1 className="whitespace-nowrap text-sm font-bold leading-none text-white">{title}</h1>
          <p className="whitespace-nowrap text-[10px] text-slate-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}