"use client";

import Image from "next/image";
import Link from "next/link";
import { useSidebarContext } from "./SidebarContext";

export function SidebarHeader({ title, subtitle, href = "/" }: { title: string; subtitle: string; href?: string }) {
  const { collapsed } = useSidebarContext();

  return (
    <div className={`flex h-16 items-center border-b border-white/10 px-4 transition-all ${collapsed ? 'justify-center' : ''}`}>
      <div className="flex items-center gap-3">
        <Link href={href} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-klasse-gold-500/15 ring-1 ring-klasse-gold-500/30" aria-label="Ir para a home do portal">
          <Image src="/logo-klasse-ui.png" alt="KLASSE" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
        </Link>
        
        {/* Esconde texto suavemente quando colapsado */}
        <div className={`overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <h1 className="whitespace-nowrap text-sm font-bold leading-none text-white">{title}</h1>
          <p className="whitespace-nowrap text-[10px] text-slate-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
