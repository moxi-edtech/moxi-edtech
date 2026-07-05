"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Zap, 
  Users, 
  FileText, 
  TrendingUp, 
  LogOut,
  ChevronLeft,
  Menu,
  X,
  Target,
  Clock,
  ChevronDown,
  UserCog,
  Headphones,
  Layers3,
  BookOpenCheck
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type PartnerAppShellProps = {
  children: React.ReactNode;
  codigo: string;
  memberName: string;
  memberRole?: 'owner' | 'admin' | 'vendas' | 'implantacao' | 'suporte_l1' | 'operator';
  activeTab: 'campanha' | 'crm' | 'onboarding' | 'escolas360' | 'suporte' | 'pops' | 'materiais' | 'equipe';
  setActiveTab: (tab: 'campanha' | 'crm' | 'onboarding' | 'escolas360' | 'suporte' | 'pops' | 'materiais' | 'equipe') => void;
  stats: {
    total_diagnosticos: number;
    convertidos: number;
  } | null;
  totalComissao: number;
  countPendenteLeads: number;
  countPendenteOnboarding: number;
  countPendenteSupport: number;
  onLogout: () => void;
};

export default function PartnerAppShell({
  children,
  codigo,
  memberName,
  memberRole = 'operator',
  activeTab,
  setActiveTab,
  stats,
  totalComissao,
  countPendenteLeads,
  countPendenteOnboarding,
  countPendenteSupport,
  onLogout
}: PartnerAppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    'desempenho-parent': true
  });

  const conversionRate = stats?.total_diagnosticos
    ? ((stats.convertidos / stats.total_diagnosticos) * 100).toFixed(1)
    : "0.0";

  interface SubNavigationItem {
    id: 'crm' | 'onboarding' | 'escolas360' | 'suporte';
    label: string;
    icon: React.ComponentType<any>;
    badge?: number;
  }

  interface NavigationItem {
    id: 'campanha' | 'crm' | 'onboarding' | 'escolas360' | 'suporte' | 'pops' | 'materiais' | 'equipe' | 'desempenho-parent';
    label: string;
    icon: React.ComponentType<any>;
    badge?: number;
    children?: SubNavigationItem[];
  }

  const navigationItems: NavigationItem[] = [
    { id: 'campanha', label: 'Campanha', icon: Zap },
    { 
      id: 'desempenho-parent', 
      label: 'Funil / CRM', 
      icon: Users,
      children: [
        { 
          id: 'crm', 
          label: 'Leads Comerciais', 
          icon: Target,
          badge: countPendenteLeads > 0 ? countPendenteLeads : undefined 
        },
        { 
          id: 'onboarding', 
          label: 'Ativação Escolar', 
          icon: Clock,
          badge: countPendenteOnboarding > 0 ? countPendenteOnboarding : undefined 
        },
        {
          id: 'escolas360',
          label: 'Escolas 360',
          icon: Layers3,
        },
        {
          id: 'suporte',
          label: 'Suporte L1',
          icon: Headphones,
          badge: countPendenteSupport > 0 ? countPendenteSupport : undefined
        }
      ]
    },
    { id: 'pops', label: 'Biblioteca POPs', icon: BookOpenCheck },
    { id: 'materiais', label: 'Materiais', icon: FileText },
    ...(memberRole === "owner" || memberRole === "admin"
      ? [{ id: 'equipe' as const, label: 'Equipe', icon: UserCog }]
      : [])
  ];

  const handleTabClick = (tabId: 'campanha' | 'crm' | 'onboarding' | 'escolas360' | 'suporte' | 'pops' | 'materiais' | 'equipe') => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return <div className="min-h-screen bg-neutral-50 font-sans flex flex-col md:flex-row">
      {/* SIDEBAR FOR DESKTOP */}
      <aside className="hidden md:flex w-64 bg-[#09090b] border-r border-zinc-900 flex-col fixed inset-y-0 left-0 z-30 text-zinc-300">
        {/* Brand/Logo Section */}
        <div className="p-5 border-b border-zinc-900">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Image
                src="/logo-klasse-ui.png"
                alt="KLASSE"
                width={18}
                height={18}
                className="h-4.5 w-4.5 object-contain"
              />
            </div>
            <div>
              <div className="font-bold tracking-tight text-white text-sm">KLASSE</div>
              <div className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">gestão escolar</div>
            </div>
          </div>

          {/* User Session Info Card */}
          <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/40 p-3">
            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Membro Ativo</p>
            <p className="text-xs font-semibold truncate text-zinc-100" title={memberName}>{memberName || "Operador"}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border shadow-none ${
                memberRole === 'owner'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {memberRole === 'owner' ? 'PROPRIETÁRIO' : memberRole.toUpperCase()}
              </Badge>
              <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">{codigo}</span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems[item.id] ?? false;

            if (hasChildren) {
              return (
                <div key={item.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200 text-left text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-100"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4.5 w-4.5 shrink-0 text-zinc-500" />
                      <span className="truncate uppercase tracking-wider">{item.label}</span>
                    </div>
                    <ChevronDown size={12} className={`text-zinc-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  
                  {isExpanded && (
                    <div className="pl-3 space-y-0.5 border-l border-zinc-900 ml-5 mt-0.5 animate-in slide-in-from-left-1 duration-200">
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = activeTab === child.id;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => handleTabClick(child.id)}
                            className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-[11px] font-semibold transition-all duration-200 text-left ${
                              isChildActive
                                ? "bg-zinc-900 text-zinc-100 border-l-2 border-emerald-500"
                                : "text-zinc-500 hover:bg-zinc-900/20 hover:text-zinc-300"
                            }`}
                          >
                            <ChildIcon
                              className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                                isChildActive ? "text-emerald-500" : "text-zinc-500"
                              }`}
                            />
                            <span className="truncate uppercase tracking-wider">{child.label}</span>
                            {child.badge !== undefined && (
                              <span className="ml-auto rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-400 border border-rose-500/20">
                                {child.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id as any)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200 text-left ${
                  isActive
                    ? "bg-zinc-900 text-zinc-100 border-l-2 border-emerald-500"
                    : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-100"
                }`}
              >
                <Icon
                  className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                    isActive ? "text-emerald-500" : "text-zinc-500"
                  }`}
                />
                <span className="truncate uppercase tracking-wider">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-auto rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-400 border border-rose-500/20">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Stats & Logout */}
        <div className="p-4 border-t border-zinc-900 space-y-3">
          <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/40 p-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider leading-none mb-1">Conversão Geral</p>
              <p className="text-xs font-semibold text-zinc-100 mt-1">{conversionRate}%</p>
            </div>
            <TrendingUp size={14} className="text-emerald-500" />
          </div>

          <Button
            onClick={onLogout}
            variant="ghost"
            className="w-full h-9 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 flex items-center justify-center gap-2"
          >
            <LogOut size={12} className="text-zinc-500" />
            Sair do CRM
          </Button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="bg-[#09090b] border-b border-zinc-900 text-white px-5 py-3 sticky top-0 z-40 md:hidden flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/influencers" className="p-1 hover:bg-zinc-900 rounded-lg text-zinc-400">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
              {codigo} · {memberName}
            </div>
            <h1 className="text-xs font-bold tracking-tight text-white uppercase">
              {activeTab === 'campanha' && "Campanha"}
              {activeTab === 'crm' && "CRM Vendas"}
              {activeTab === 'onboarding' && "Funil Ativação"}
              {activeTab === 'suporte' && "Suporte L1"}
              {activeTab === 'materiais' && "Materiais"}
              {activeTab === 'equipe' && "Equipe"}
            </h1>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400"
          aria-label="Alternar menu"
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* MOBILE NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[49px] z-30 bg-[#09090b] text-zinc-300 flex flex-col md:hidden animate-in fade-in duration-200">
          <nav className="flex-1 p-5 space-y-2 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItems[item.id] ?? false;

              if (hasChildren) {
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                      className="w-full flex items-center justify-between rounded-lg px-4 py-3 text-xs font-semibold text-zinc-400 hover:bg-zinc-900/40"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4.5 w-4.5 text-zinc-500" />
                        <span className="uppercase tracking-wider">{item.label}</span>
                      </div>
                      <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="pl-4 space-y-1 border-l border-zinc-900 ml-6">
                        {item.children!.map((child) => {
                          const ChildIcon = child.icon;
                          const isChildActive = activeTab === child.id;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => handleTabClick(child.id)}
                              className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-[11px] font-semibold transition-all text-left ${
                                isChildActive
                                  ? "bg-zinc-900 text-zinc-100 border-l-2 border-emerald-500"
                                  : "text-zinc-500 hover:bg-zinc-900/20"
                              }`}
                            >
                              <ChildIcon className={`h-3.5 w-3.5 ${isChildActive ? "text-emerald-500" : "text-zinc-500"}`} />
                              <span className="uppercase tracking-wider">{child.label}</span>
                              {child.badge !== undefined && (
                                <span className="ml-auto rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-400 border border-rose-500/20">
                                  {child.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id as any)}
                  className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-xs font-semibold transition-all text-left ${
                    isActive
                      ? "bg-zinc-900 text-zinc-100 border-l-2 border-emerald-500"
                      : "text-zinc-400 hover:bg-zinc-900/40"
                  }`}
                >
                  <Icon
                    className={`h-4.5 w-4.5 ${isActive ? "text-emerald-500" : "text-zinc-500"}`}
                  />
                  <span className="uppercase tracking-wider">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-auto rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-400 border border-rose-500/20">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="p-5 border-t border-zinc-900 space-y-3">
            <div className="rounded-xl bg-zinc-900/30 border border-zinc-800/40 p-3 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Conversão Geral</p>
                <p className="text-xs font-semibold text-zinc-100">{conversionRate}%</p>
              </div>
              <TrendingUp size={14} className="text-emerald-500" />
            </div>
            <Button
              onClick={onLogout}
              variant="ghost"
              className="w-full h-9 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 flex items-center justify-center gap-2"
            >
              <LogOut size={12} className="text-zinc-500" />
              Sair do CRM
            </Button>
          </div>
        </div>
      )}

      {/* CONTENT REGION (Indented on Desktop for fixed sidebar) */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Desktop Head Banner / Stats */}
        <header className="hidden md:flex bg-white/80 backdrop-blur-md border-b border-zinc-200/50 px-8 py-4 items-center justify-between sticky top-0 z-20">
          <div>
            <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Painel de Desempenho</p>
            <h1 className="text-sm font-bold text-zinc-950 tracking-tight">
              {activeTab === 'campanha' && "Central de Campanha"}
              {activeTab === 'crm' && "Funil de Vendas (CRM)"}
              {activeTab === 'onboarding' && "Funil de Ativação / Onboarding"}
              {activeTab === 'suporte' && "Suporte L1"}
              {activeTab === 'materiais' && "Materiais de Apoio"}
              {activeTab === 'equipe' && "Equipe do Parceiro"}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Escolas Indicadas</p>
              <p className="text-xs font-semibold text-zinc-900 font-mono mt-0.5">{stats?.total_diagnosticos || 0}</p>
            </div>
            {memberRole === 'owner' && (
              <>
                <span className="text-zinc-200">|</span>
                <div className="text-right">
                  <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Faturamento Estimado</p>
                  <p className="text-xs font-semibold text-emerald-600 font-mono mt-0.5">
                    Kz {totalComissao.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Viewport content injection */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>;
}
