"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import SignOutButton from "@/components/auth/SignOutButton";
import BackButton from "@/components/navigation/BackButton";
import Link from "next/link"; // Add this import
import {
  ChevronDownIcon,
  BellIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline"; // Keep these
import * as Icons from "lucide-react";
import clsx from "clsx";
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans";
import { useUserRole } from "@/hooks/useUserRole"; // Import useUserRole
import { sidebarConfig, type IconName } from "@/lib/sidebarNav"; // Import sidebarConfig and IconName

import Image from "next/image";
import { usePathname } from "next/navigation"; // Import usePathname

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
  <div className="px-3 py-3 flex items-center gap-2 overflow-hidden">
    <Image src="/Logo Klasse.png" alt="Klasse Logo" width={collapsed ? 40 : 120} height={40} />
  </div>
);

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname(); // Initialize usePathname
  const { userRole, isLoading: isLoadingRole } = useUserRole(); // Get user role
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [plan, setPlan] = useState<PlanTier | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [escolaNome, setEscolaNome] = useState<string | null>(null)

  const [collapsed, setCollapsed] = useState(false);
  const [escolaIdState, setEscolaIdState] = useState<string | null>(null); // New state for escolaId

  // Derive sidebar items based on user role
  const navItems = useMemo(() => {
    if (isLoadingRole || !userRole) return [];
    const items = sidebarConfig[userRole] || [];
    const replaced = items.map((item) => {
      if (!escolaIdState) return item;
      if (item.href.includes("[escolaId]")) {
        return { ...item, href: item.href.replace("[escolaId]", escolaIdState) };
      }
      if (item.href.includes("[id]")) {
        return { ...item, href: item.href.replace("[id]", escolaIdState) };
      }
      return item;
    });
    return replaced.filter((item) => !item.href.includes("["));
  }, [userRole, isLoadingRole, escolaIdState]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar:collapsed");
      if (saved != null) setCollapsed(saved === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
    } catch {}
    // Atualiza a variável CSS global para manter largura reativa
    try {
      document.documentElement.style.setProperty(
        "--sidebar-w",
        collapsed ? "80px" : "256px"
      );
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    ;(async () => {
      try {
        const supabaseClient = await supabase
        const { data: prof } = await supabaseClient.from('profiles').select('escola_id').order('created_at', { ascending: false }).limit(1)
        const escolaId = (prof?.[0] as { escola_id: string | null })?.escola_id
        if (!mounted || !escolaId) return
        setEscolaIdState(escolaId); // Set the new state variable

        // Carrega nome e plano da escola via cache local
        try {
          const cacheKey = `escolas:nome:${escolaId}`
          if (typeof sessionStorage !== 'undefined') {
            const cached = sessionStorage.getItem(cacheKey)
            if (cached) {
              const parsed = JSON.parse(cached) as { nome?: string | null; plano?: PlanTier | null }
              if (mounted && parsed?.nome) setEscolaNome(String(parsed.nome))
              if (mounted && parsed?.plano) setPlan(parsePlanTier(parsed.plano))
              return
            }
          }
          const res = await fetch(`/api/escolas/${escolaId}/nome`, { cache: 'no-store' })
          const json = await res.json().catch(() => null)
          if (mounted && res.ok && json?.ok && json?.nome) {
            setEscolaNome(String(json.nome))
          }
          if (mounted) {
            const p = json?.plano ?? null
            if (p) setPlan(parsePlanTier(p))
          }
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(cacheKey, JSON.stringify({ nome: json?.nome ?? null, plano: json?.plano ?? null }))
          }
        } catch {}
        
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  // Carrega nome do usuário logado para o avatar
  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    ;(async () => {
      try {
        const supabaseClient = await supabase
        const { data: auth } = await supabaseClient.auth.getUser()
        const userId = auth?.user?.id
        if (!mounted || !userId) return
        const { data: prof } = await supabaseClient
          .from('profiles')
          .select('nome, email')
          .eq('user_id', userId)
          .maybeSingle()
        if (!mounted) return
        const nome = (prof as any)?.nome as string | undefined
        const email = (prof as any)?.email as string | undefined
        setUserName((nome && nome.trim()) || email || null)
      } catch {
        // noop
      }
    })()
    return () => { mounted = false }
  }, [])

  const userInitials = useMemo(() => {
    const src = userName || 'Administrador'
    const parts = src.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
    if (parts.length === 0) return 'AD'
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? ''
    const calc = (first + last).toUpperCase()
    return calc || 'AD'
  }, [userName])

  const sidebarW = collapsed ? 64 : 256;

  return (
        <div className="flex min-h-screen w-full bg-slate-50">
          {/* Sidebar */}
          <aside
            className={clsx(
              "fixed top-0 left-0 z-40 h-screen border-r border-slate-200 bg-white transition-[width] duration-200 ease-in-out",
            )}
            style={{ width: "var(--sidebar-w, 256px)" }}
            // Adiciona flex-shrink-0 para garantir que a sidebar não encolha
            // e z-index para garantir que ela fique acima do conteúdo principal
            aria-label="Navegação lateral"
          >
            {/* Topo com logo + botão de collapse */}
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <Logo collapsed={collapsed} />
    
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60"
                aria-pressed={collapsed}
                aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
                title={collapsed ? "Expandir" : "Recolher"}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  {collapsed ? (
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  ) : (
                    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  )}
                </svg>
              </button>
            </div>
    
            {/* (opcional) busca / nome da escola */}
            <div className={clsx("px-3", collapsed && "hidden")}>
              {escolaNome && (
                <div className="px-6 -mt-2 mb-2">
                  <div className="text-[11px] uppercase tracking-wide text-moxinexa-gray">Escola</div>
                  <div className="text-sm font-semibold text-moxinexa-dark truncate" title={escolaNome}>
                    {escolaNome}
                  </div>
                </div>
              )}
              
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
            </div>
    
            {/* Navegação */}
            <nav className="mt-2">
              <ul className="space-y-1 px-2">
                {navItems.map((item) => {
                  const Icon = Icons[item.icon as IconName] ?? Icons.HelpCircle;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                                        const IconComponent = Icon as React.ElementType;
                                        return (
                                          <li key={item.href}>
                                            <Link
                                              href={item.href}
                                              className={clsx(
                                                "group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium w-full",
                                                isActive
                                                  ? "bg-moxinexa-teal text-white"
                                                  : "text-slate-700 hover:bg-slate-100"
                                              )}
                                              title={item.label}
                                            >
                                              <IconComponent className={clsx("h-5 w-5 shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700")} />
                                              {!collapsed && <span className="truncate">{item.label}</span>}
                                              {item.badge && !collapsed && (
                                                <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                                  {item.badge}
                                                </span>
                                              )}
                                            </Link>
                                          </li>
                                        );                })}
              </ul>
            </nav>
          </aside>
    
          {/* Wrapper para o conteúdo principal, que agora é scrollável */}
          <div
            className="flex-1 overflow-y-auto transition-[padding] duration-200 ease-in-out"
            style={{ paddingLeft: "var(--sidebar-w, 256px)" }}
          >
            <main className="flex flex-col min-h-full">
              {/* Header modernizado */}
              <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm m-4">
                <div className="flex items-center gap-4">
                  <h1 className="text-xl font-semibold text-moxinexa-dark">
                    {navItems.find(item => pathname === item.href || pathname.startsWith(item.href + "/"))?.label || "Dashboard"}
                  </h1>
                  {plan && (
                    <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-gray-100 border text-gray-600">Plano: {PLAN_NAMES[plan]}</span>
                  )}
                  {escolaNome && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700" title={escolaNome}>
                      Escola: {escolaNome}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-5">
                  <button className="relative p-2 rounded-full bg-moxinexa-light/30 hover:bg-moxinexa-light/50 transition-colors">
                    <BellIcon className="w-5 h-5 text-moxinexa-dark" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                  </button>
                  
                  <div className="hidden md:flex h-6 w-px bg-moxinexa-light/50"></div>
                  
                  <button className="flex items-center gap-2 bg-white rounded-full pl-1 pr-3 py-1 shadow-sm border border-moxinexa-light/50 hover:shadow-md transition-shadow">
                    <UserAvatar initials={userInitials} name={userName || 'Administrador'} />
                  </button>
    
                  <SignOutButton
                    label="Sair"
                    className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    title="Sair"
                  />
                </div>
              </div>
    
              {/* Conteúdo dinâmico com card moderno */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-moxinexa-light/30 mx-4 flex-grow">
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
        </div>
  );
}
