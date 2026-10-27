"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import SignOutButton from "@/components/auth/SignOutButton";
import LockScreenButton from "@/components/session/LockScreenButton";
import { requestSessionConfig } from "@/components/session/SessionLockProvider";
import BackButton from "@/components/navigation/BackButton";
import ThemeToggle from "@/components/ThemeToggle";
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
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { fetchEscolaInfo } from "@/lib/escolaInfoClient";

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
const Logo = ({ collapsed = false, href = "/" }: { collapsed?: boolean; href?: string }) => (
  <Link href={href} className="px-3 py-3 flex items-center gap-3 overflow-hidden" aria-label="Ir para a home do portal">
    <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30 flex items-center justify-center">
      <Image src="/logo-klasse-ui.png" alt="KLASSE" width={22} height={22} className="h-5 w-5 object-contain" />
    </div>
    {!collapsed && (
      <div className="min-w-0">
        <div className="font-semibold tracking-tight leading-5 text-foreground">KLASSE</div>
        <div className="text-xs text-muted-foreground font-medium">gestão escolar</div>
      </div>
    )}
  </Link>
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

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem("sidebar:collapsed");
      return saved === "1";
    } catch {
      return false;
    }
  });
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
  const homeHref = navItems[0]?.href || "/";

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
        const { data: userRes } = await supabaseClient.auth.getUser()
        const user = userRes?.user
        if (!user) return
        const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null
        const escolaId = await resolveEscolaIdForUser(
          supabaseClient,
          user.id,
          null,
          metaEscolaId ? String(metaEscolaId) : null
        )
        if (!mounted || !escolaId) return
        setEscolaIdState(escolaId); // Set the new state variable

        // Carrega nome e plano da escola via cache local + dedupe em memória
        try {
          const info = await fetchEscolaInfo(escolaId)
          if (!mounted) return
          setEscolaNome(info.nome ? String(info.nome) : null)
          setPlan(info.plano ? parsePlanTier(info.plano as PlanTier) : null)
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
        <div className="flex min-h-screen w-full bg-background text-foreground">
          {/* Sidebar */}
          <aside
            className={clsx(
              "fixed top-0 left-0 z-40 h-screen border-r border-border bg-card transition-[width] duration-200 ease-in-out flex flex-col",
            )}
            style={{ width: "var(--sidebar-w, 256px)" }}
            // Adiciona flex-shrink-0 para garantir que a sidebar não encolha
            // e z-index para garantir que ela fique acima do conteúdo principal
            aria-label="Navegação lateral"
          >
            {/* Topo com logo + botão de collapse */}
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <Logo collapsed={collapsed} href={homeHref} />
    
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60"
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
    
            {/* (opcional) busca */}
            <div className={clsx("px-3", collapsed && "hidden")}>
              
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
    
            {/* Navegação scrollável */}
            <nav className="flex-1 overflow-y-auto mt-2 px-2">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const Icon = Icons[item.icon as IconName] ?? Icons.HelpCircle;
                  const isActive = !!pathname && (pathname === item.href || pathname.startsWith(item.href + "/"));
                  const IconComponent = Icon as React.ElementType;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={clsx(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium w-full transition-all duration-200",
                          isActive
                            ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                            : "text-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title={item.label}
                      >
                        <IconComponent className={clsx("h-5 w-5 shrink-0 transition-colors", isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {item.badge && !collapsed && (
                          <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Footer fixo no fundo */}
            <div className="mt-auto p-4 border-t border-border">
              <div className={clsx(
                "flex items-center gap-3 rounded-2xl p-2 transition-colors",
                !collapsed && "bg-muted border border-border"
              )}>
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-foreground">{userInitials}</span>
                </div>
                {!collapsed && (
                  <div className="min-w-0">
                    <div className="text-xs font-black text-foreground truncate uppercase tracking-tight">
                      {escolaNome || "Klasse"}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                      {plan ? PLAN_NAMES[plan] : "SaaS"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
    
          {/* Wrapper para o conteúdo principal, que agora é scrollável */}
          <div
            className="flex-1 overflow-y-auto transition-[padding] duration-200 ease-in-out"
            style={{ paddingLeft: "var(--sidebar-w, 256px)" }}
          >
            <main className="flex flex-col min-h-full">
              {/* Header modernizado */}
              <div className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <h1 className="text-xl font-semibold text-foreground">
                    {navItems.find(item => !!pathname && (pathname === item.href || pathname.startsWith(item.href + "/")))?.label || "Dashboard"}
                  </h1>
                  {plan && (
                    <span className="rounded-full border border-border bg-muted px-2 py-1 text-[10px] uppercase text-muted-foreground">Plano: {PLAN_NAMES[plan]}</span>
                  )}
                  {escolaNome && (
                    <span className="rounded-full border border-border bg-muted px-2 py-1 text-[10px] text-muted-foreground" title={escolaNome}>
                      Escola: {escolaNome}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3">
                  <ThemeToggle iconOnly />
                  <button className="relative p-2 rounded-full bg-moxinexa-light/30 hover:bg-moxinexa-light/50 transition-colors">
                    <BellIcon className="w-5 h-5 text-moxinexa-dark" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                  </button>
                  
                  <div className="hidden md:flex h-6 w-px bg-moxinexa-light/50"></div>
                  
                  <button className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 shadow-sm hover:shadow-md transition-shadow">
                    <UserAvatar initials={userInitials} name={userName || 'Administrador'} />
                  </button>

                  <button
                    onClick={() => requestSessionConfig()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent"
                    title="Preferências de Sessão"
                  >
                    <Icons.Settings className="h-4 w-4" />
                  </button>

                  <LockScreenButton
                    iconOnly
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground transition-colors hover:bg-accent"
                  />

                  <SignOutButton
                    label="Sair"
                    className="px-3 py-1.5 text-xs bg-muted text-foreground rounded-md hover:bg-slate-600 transition-colors"
                    title="Sair"
                  />
                </div>
              </div>
    
              {/* Conteúdo dinâmico com card moderno */}
              <div className="mx-4 flex-grow rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-3">
                  <BackButton />
                </div>
                {children}
              </div>
    
              {/* Footer moderno */}
              <footer className="mt-8 text-center text-sm text-muted-foreground">
                <p>KLASSE • Gestão escolar em escala</p>
                <p className="mt-1">Sistema de gestão escolar · Todos os direitos reservados</p>
              </footer>
            </main>
          </div>
        </div>
  );
}
