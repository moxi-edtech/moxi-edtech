"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import SignOutButton from "@/components/auth/SignOutButton";
import BackButton from "@/components/navigation/BackButton";
import {
  HomeIcon,
  UsersIcon,
  AcademicCapIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  LifebuoyIcon,
  Bars3Icon,
  ChevronDownIcon,
  BellIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

// Definir tipos específicos
type MenuItemName = 
  | "Dashboard" 
  | "Alunos & Matrículas" 
  | "Professores & Notas" 
  | "Financeiro" 
  | "Configurações Locais" 
  | "Relatórios Locais" 
  | "Suporte Local";

const menuItems = [
  { name: "Dashboard", icon: HomeIcon },
  { name: "Alunos & Matrículas", icon: UsersIcon },
  { name: "Professores & Notas", icon: AcademicCapIcon },
  { name: "Financeiro", icon: BanknotesIcon },
  { name: "Configurações Locais", icon: Cog6ToothIcon },
  { name: "Relatórios Locais", icon: ChartBarIcon },
  { name: "Suporte Local", icon: LifebuoyIcon },
];

// Componente de Avatar Reutilizável
const UserAvatar = ({ initials, name }: { initials: string; name: string }) => (
  <div className="flex items-center gap-3">
    <div className="relative">
      <div 
        className="bg-gradient-to-r from-teal-500 to-sky-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg"
        aria-label={`Avatar de ${name}`}
      >
        {initials}
      </div>
      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-teal-400 rounded-full border-2 border-white"></div>
    </div>
    <div className="hidden md:flex flex-col">
      <span className="font-medium text-sm">{name}</span>
      <span className="text-xs text-moxinexa-gray">Administrador</span>
    </div>
    <ChevronDownIcon className="w-4 h-4 text-moxinexa-gray hidden md:block" />
  </div>
);

// Componente de Logo
const Logo = ({ collapsed = false }: { collapsed?: boolean }) => (
  <div className="px-6 py-4 flex items-center gap-3">
    <div className="bg-gradient-to-r from-teal-500 to-sky-600 text-white rounded-xl w-10 h-10 flex items-center justify-center shadow-lg">
      <span className="text-lg">🎓</span>
    </div>
    {!collapsed && (
      <div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-teal-500 to-sky-600 bg-clip-text text-transparent">
          MoxiNexa
        </h1>
        <p className="text-xs text-moxinexa-light opacity-70">Sistema Educacional</p>
      </div>
    )}
  </div>
);

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<MenuItemName>("Dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [plan, setPlan] = useState<"basico"|"standard"|"premium"|null>(null)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    ;(async () => {
      try {
        const { data: prof } = await supabase.from('profiles').select('escola_id').order('created_at', { ascending: false }).limit(1)
        const escolaId = (prof?.[0] as any)?.escola_id as string | null
        if (!mounted || !escolaId) return
        const { data: esc } = await supabase.from('escolas').select('plano').eq('id', escolaId).maybeSingle()
        if (!mounted) return
        const p = ((esc as any)?.plano || null) as any
        if (p && ['basico','standard','premium'].includes(p)) setPlan(p)
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="flex min-h-screen font-sans bg-gradient-to-br from-moxinexa-light/20 to-white text-moxinexa-dark">
      {/* Overlay para mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar modernizada */}
      <aside className={`fixed md:relative w-80 md:w-72 bg-white text-moxinexa-dark flex-col z-30
        shadow-xl md:shadow-lg md:rounded-r-2xl transition-all duration-300
        ${isMobileMenuOpen ? 'flex translate-x-0' : '-translate-x-full'} 
        md:flex md:translate-x-0 h-full`}>
        
        <div className="flex justify-between items-center pr-4">
          <Logo collapsed={sidebarCollapsed} />
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-moxinexa-light/30 text-moxinexa-teal hover:bg-moxinexa-light/50 transition-colors"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-4 py-2">
          <div className="relative mb-4">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-moxinexa-gray" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="w-full pl-10 pr-4 py-2.5 bg-moxinexa-light/20 rounded-lg border border-moxinexa-light/30 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal/30 focus:border-moxinexa-teal text-sm"
            />
          </div>
        </div>
        
        <nav className="flex-1 space-y-1 px-4 py-4">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setActive(item.name as MenuItemName);
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center w-full px-4 py-3 rounded-xl transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-moxinexa-teal/30
                ${active === item.name
                  ? "bg-gradient-to-r from-teal-500/10 to-sky-600/10 text-moxinexa-teal border-l-4 border-moxinexa-teal shadow-sm"
                  : "hover:bg-moxinexa-light/30 text-moxinexa-gray hover:text-moxinexa-dark"
                }`}
              aria-current={active === item.name ? "page" : undefined}
            >
              <item.icon className="w-5 h-5 mr-3" aria-hidden="true" />
              <span className="font-medium">{item.name}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-4 mt-auto border-t border-moxinexa-light/30">
          <div className="bg-moxinexa-light/10 p-4 rounded-xl mb-4">
            <h3 className="font-semibold text-sm text-moxinexa-dark">Precisa de ajuda?</h3>
            <p className="text-xs text-moxinexa-gray mt-1">Acesse nossa central de suporte</p>
            <button className="mt-2 w-full bg-moxinexa-teal/10 hover:bg-moxinexa-teal/20 text-moxinexa-teal text-xs font-medium py-2 rounded-lg transition-colors">
              Contatar Suporte
            </button>
          </div>
          
          <div className="px-4 py-3 text-xs text-moxinexa-gray text-center">
            © 2025 MoxiNexa · v2.1.0
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Header modernizado */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm mb-6">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 rounded-lg bg-moxinexa-light/30 hover:bg-moxinexa-light/50 transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Abrir menu"
            >
              <Bars3Icon className="w-5 h-5 text-moxinexa-dark" />
            </button>
            <h1 className="text-xl font-semibold text-moxinexa-dark">
              {active}
            </h1>
            {plan && (
              <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-gray-100 border text-gray-600">Plano: {plan}</span>
            )}
          </div>
          
          <div className="flex items-center gap-5">
            <button className="relative p-2 rounded-full bg-moxinexa-light/30 hover:bg-moxinexa-light/50 transition-colors">
              <BellIcon className="w-5 h-5 text-moxinexa-dark" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            <div className="hidden md:flex h-6 w-px bg-moxinexa-light/50"></div>
            
            <button className="flex items-center gap-2 bg-white rounded-full pl-1 pr-3 py-1 shadow-sm border border-moxinexa-light/50 hover:shadow-md transition-shadow">
              <UserAvatar initials="AD" name="Admin Escola" />
            </button>

            <SignOutButton
              label="Sair"
              className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              title="Sair"
            />
          </div>
        </div>

        {/* Conteúdo dinâmico com card moderno */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-moxinexa-light/30">
          <div className="mb-3">
            <BackButton />
          </div>
          {children}
        </div>

        {/* Footer moderno */}
        <footer className="mt-8 text-center text-sm text-moxinexa-gray">
          <p>MoxiNexa - Transformando a educação através da tecnologia</p>
          <p className="mt-1">Sistema de gestão escolar · Todos os direitos reservados</p>
        </footer>
      </main>
    </div>
  );
}
