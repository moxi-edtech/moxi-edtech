// apps/web/src/components/super-admin/Sidebar.tsx
"use client";

import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UsersIcon,
  AcademicCapIcon,
  BanknotesIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  LifebuoyIcon,
  BuildingLibraryIcon,
  BoltIcon, // ⚡ item especial Seed
  XMarkIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", icon: HomeIcon, href: "/super-admin" },
  { name: "Escolas", icon: BuildingLibraryIcon, href: "/super-admin/escolas" },
  { name: "Usuários Globais", icon: UsersIcon, href: "/super-admin/usuarios" },
  { name: "Matrículas", icon: AcademicCapIcon, href: "/super-admin/matriculas" },
  { name: "Financeiro", icon: BanknotesIcon, href: "/financeiro" },
  { name: "Relatórios", icon: ChartBarIcon, href: "/super-admin/relatorios" },
  { name: "Configurações", icon: Cog6ToothIcon, href: "/super-admin/configuracoes" },
  { name: "Suporte", icon: LifebuoyIcon, href: "/super-admin/suporte" },

  // 🚀 Item especial de Seed
  { name: "Seed Super Admin", icon: BoltIcon, href: "/admin-seed" },
];

// Componente de Logo
const Logo = () => (
  <div className="px-6 py-5 flex items-center gap-3">
    <div className="bg-gradient-to-r from-moxinexa-teal to-moxinexa-navy text-white rounded-xl w-10 h-10 flex items-center justify-center shadow-lg">
      <span className="text-lg">🎓</span>
    </div>
    <div>
      <h1 className="text-xl font-bold bg-gradient-to-r from-white to-moxinexa-light bg-clip-text text-transparent">
        MoxiNexa
      </h1>
      <p className="text-xs text-moxinexa-light/80">Super Admin</p>
    </div>
  </div>
);

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // removed unused collapsed state

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <>
      {/* Overlay para mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-80 lg:w-72 bg-gradient-to-b from-moxinexa-navy/95 to-moxinexa-teal/95 text-white flex flex-col shadow-xl backdrop-blur-sm
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 transition-transform duration-300 h-full`}>
        
        <div className="flex justify-between items-center pr-4">
          <Logo />
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de busca */}
        <div className="px-4 py-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-moxinexa-light/70" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 text-sm placeholder:text-moxinexa-light/70"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
                  ${active
                    ? "bg-white/20 text-white shadow-sm border-l-4 border-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
              >
                <item.icon className={`w-5 h-5 ${active ? "text-white" : "text-moxinexa-light/70 group-hover:text-white"}`} />
                <span>{item.name}</span>
                {item.name === "Seed Super Admin" && (
                  <span className="ml-auto px-2 py-0.5 bg-amber-400/20 text-amber-300 text-xs rounded-full border border-amber-400/30">
                    Novo
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Footer com informações do sistema */}
        <div className="p-4 border-t border-white/10">
          <div className="bg-white/5 p-3 rounded-xl mb-3">
            <h3 className="font-semibold text-sm text-white">Status do Sistema</h3>
            <div className="flex items-center mt-1">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
              <p className="text-xs text-moxinexa-light/80">Todos os sistemas operacionais</p>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-xs text-moxinexa-light/70">
            <span>v2.1.0 · Super Admin</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </aside>

      {/* Botão para abrir menu mobile */}
      <button 
        className="fixed bottom-4 left-4 z-40 lg:hidden p-3 rounded-full bg-gradient-to-r from-moxinexa-teal to-moxinexa-navy text-white shadow-lg"
        onClick={() => setIsMobileMenuOpen(true)}
        aria-label="Abrir menu"
      >
        <Bars3Icon className="w-6 h-6" />
      </button>
    </>
  );
}
