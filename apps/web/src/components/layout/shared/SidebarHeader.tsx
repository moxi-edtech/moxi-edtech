"use client";

import Image from "next/image";
import Link from "next/link";
import { useSidebarContext } from "./SidebarContext";

export function SidebarHeader({ title, subtitle, href = "/" }: { title: string; subtitle: string; href?: string }) {
  const { collapsed } = useSidebarContext();

  return (
    <div className={`flex h-16 shrink-0 min-w-0 items-center border-b border-sidebar-border px-4 transition-all ${collapsed ? 'justify-center' : ''}`}>
      <div className="flex min-w-0 items-center gap-3">
        <Link href={href} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30" aria-label="Ir para a home do portal">
          <Image src="/logo-klasse-ui.png" alt="KLASSE" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
        </Link>
        
        {/* Esconde texto suavemente quando colapsado */}
        <div className={`min-w-0 overflow-hidden transition-opacity duration-300 ${collapsed ? 'hidden' : 'flex-1'}`}>
          <h1 className="truncate text-sm font-bold leading-none text-white" title={title}>{title}</h1>
          <p className="truncate text-[10px] text-sidebar-muted-foreground" title={subtitle}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
