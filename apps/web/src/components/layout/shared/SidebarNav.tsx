"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarContext } from "./SidebarContext";
// Importa os ícones dinâmicos do Lucide ou Heroicons aqui
import * as Icons from "lucide-react"; 

export type NavItem = {
  label: string;
  href: string;
  icon: string; // Nome do ícone (ex: 'LayoutDashboard')
  badge?: string;
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { collapsed } = useSidebarContext();

  return (
    <nav className="flex-1 space-y-1 py-4">
      {items.map((item) => {
        const Icon = (Icons as any)[item.icon] || Icons.HelpCircle;
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined} // Tooltip nativo se colapsado
            className={`
              relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all mx-2
              ${isActive 
                ? "bg-teal-600 text-white shadow-md shadow-teal-900/20" 
                : "text-slate-400 hover:bg-white/5 hover:text-white"
              }
              ${collapsed ? "justify-center px-0" : ""}
            `}
          >
            <Icon size={20} className="shrink-0" />
            
            <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>
              {item.label}
            </span>

            {/* Badge (Pendente, Novo, etc) */}
            {item.badge && !collapsed && (
              <span className="ml-auto rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                {item.badge}
              </span>
            )}
            
            {/* Ponto indicador de Badge se colapsado */}
            {item.badge && collapsed && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}