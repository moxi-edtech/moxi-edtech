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
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type PartnerAppShellProps = {
  children: React.ReactNode;
  codigo: string;
  memberName: string;
  memberRole?: 'owner' | 'operator';
  activeTab: 'campanha' | 'crm' | 'onboarding' | 'materiais';
  setActiveTab: (tab: 'campanha' | 'crm' | 'onboarding' | 'materiais') => void;
  stats: {
    total_diagnosticos: number;
    convertidos: number;
  } | null;
  totalComissao: number;
  countPendenteLeads: number;
  countPendenteOnboarding: number;
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
    id: 'crm' | 'onboarding';
    label: string;
    icon: React.ComponentType<any>;
    badge?: number;
  }

  interface NavigationItem {
    id: 'campanha' | 'crm' | 'onboarding' | 'materiais' | 'desempenho-parent';
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
        }
      ]
    },
    { id: 'materiais', label: 'Materiais', icon: FileText }
  ];

  const handleTabClick = (tabId: 'campanha' | 'crm' | 'onboarding' | 'materiais') => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col md:flex-row">
      {/* SIDEBAR FOR DESKTOP */}
      <aside className="hidden md:flex w-64 bg-slate-950 border-r border-slate-800/80 flex-col fixed inset-y-0 left-0 z-30 text-slate-100">
        {/* Brand/Logo Section */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-[#E3B23C]/10 ring-1 ring-[#E3B23C]/30 flex items-center justify-center">
              <Image
                src="/logo-klasse-ui.png"
                alt="KLASSE"
                width={22}
                height={22}
                className="h-5 w-5 object-contain"
              />
            </div>
            <div>
              <div className="font-semibold tracking-tight leading-5 text-white">KLASSE</div>
              <div className="text-xs text-slate-400 font-medium">gestão escolar</div>
            </div>
          </div>

          {/* User Session Info Card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Membro Ativo</p>
            <p className="text-xs font-black truncate text-white" title={memberName}>{memberName || "Operador"}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                memberRole === 'owner'
                  ? 'bg-[#E3B23C]/10 text-[#E3B23C] border-[#E3B23C]/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {memberRole === 'owner' ? 'PROPRIETÁRIO' : 'OPERADOR'}
              </Badge>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{codigo}</span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1.5">
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
                    className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 text-left text-slate-300 hover:bg-slate-900/70 hover:text-white`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0 text-slate-500" />
                      <span className="truncate font-semibold uppercase tracking-wider text-xs">{item.label}</span>
                    </div>
                    <ChevronDown size={14} className={`text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  
                  {isExpanded && (
                    <div className="pl-4 space-y-1 animate-in slide-in-from-left-1 duration-200">
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = activeTab === child.id;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => handleTabClick(child.id)}
                            className={`w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 text-left ${
                              isChildActive
                                ? "bg-[#1F6B3B]/10 text-white ring-1 ring-[#1F6B3B]/30"
                                : "text-slate-400 hover:bg-slate-900/60 hover:text-white"
                            }`}
                          >
                            <ChildIcon
                              className={`h-4 w-4 shrink-0 transition-colors ${
                                isChildActive ? "text-[#E3B23C]" : "text-slate-600"
                              }`}
                            />
                            <span className="truncate uppercase tracking-wider">{child.label}</span>
                            {child.badge !== undefined && (
                              <span className={`ml-auto rounded bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-black ring-1 ring-rose-500/20 ${
                                isChildActive ? "text-rose-300" : "text-rose-400"
                              }`}>
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
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 text-left ${
                  isActive
                    ? "bg-[#1F6B3B]/10 text-white ring-1 ring-[#1F6B3B]/30"
                    : "text-slate-300 hover:bg-slate-900/70 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-colors ${
                    isActive ? "text-[#E3B23C]" : "text-slate-500 group-hover:text-[#E3B23C]"
                  }`}
                />
                <span className="truncate font-semibold uppercase tracking-wider text-xs">{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`ml-auto rounded bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold ring-1 ring-rose-500/20 ${
                    isActive ? "text-rose-300" : "text-rose-400"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Stats & Logout */}
        <div className="p-4 border-t border-slate-800/80 space-y-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Conversão Geral</p>
              <p className="text-sm font-black text-white">{conversionRate}%</p>
            </div>
            <TrendingUp size={16} className="text-[#E3B23C]" />
          </div>

          <Button
            onClick={onLogout}
            className="w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-none"
          >
            <LogOut size={14} className="text-slate-400" />
            Sair do CRM
          </Button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="bg-slate-950 border-b border-slate-800 text-white px-6 py-4 sticky top-0 z-40 md:hidden flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/influencers" className="p-1 hover:bg-slate-900 rounded-lg text-slate-400">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {codigo} · {memberName}
            </div>
            <h1 className="text-sm font-black tracking-tight text-white uppercase">
              {activeTab === 'campanha' && "Campanha"}
              {activeTab === 'crm' && "CRM Vendas"}
              {activeTab === 'onboarding' && "Funil Ativação"}
              {activeTab === 'materiais' && "Materiais"}
            </h1>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 hover:bg-slate-900 rounded-lg text-slate-400"
          aria-label="Alternar menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* MOBILE NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[61px] z-30 bg-slate-950 text-white flex flex-col md:hidden animate-in fade-in duration-200">
          <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItems[item.id] ?? false;

              if (hasChildren) {
                return (
                  <div key={item.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                      className="w-full flex items-center justify-between rounded-2xl px-5 py-4 text-sm font-bold text-slate-300 hover:bg-slate-900/70"
                    >
                      <div className="flex items-center gap-4">
                        <Icon className="h-5 w-5 text-slate-500" />
                        <span className="uppercase tracking-widest text-xs">{item.label}</span>
                      </div>
                      <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="pl-6 space-y-2">
                        {item.children!.map((child) => {
                          const ChildIcon = child.icon;
                          const isChildActive = activeTab === child.id;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => handleTabClick(child.id)}
                              className={`w-full flex items-center gap-4 rounded-xl px-4 py-3 text-xs font-bold transition-all text-left ${
                                isChildActive
                                  ? "bg-[#1F6B3B]/10 text-white ring-1 ring-[#1F6B3B]/30"
                                  : "text-slate-400 hover:bg-slate-900/60"
                              }`}
                            >
                              <ChildIcon className={`h-4 w-4 ${isChildActive ? "text-[#E3B23C]" : "text-slate-600"}`} />
                              <span className="uppercase tracking-wider">{child.label}</span>
                              {child.badge !== undefined && (
                                <span className="ml-auto rounded bg-rose-500/10 px-2 py-0.5 text-[9px] font-black text-rose-400 ring-1 ring-rose-500/20">
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
                  className={`w-full flex items-center gap-4 rounded-2xl px-5 py-4 text-sm font-bold transition-all text-left ${
                    isActive
                      ? "bg-[#1F6B3B]/10 text-white ring-1 ring-[#1F6B3B]/30"
                      : "text-slate-300 hover:bg-slate-900/70"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${isActive ? "text-[#E3B23C]" : "text-slate-500"}`}
                  />
                  <span className="uppercase tracking-widest text-xs">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-auto rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 ring-1 ring-rose-500/20">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="p-6 border-t border-slate-900 space-y-4">
            <div className="rounded-2xl bg-white/5 p-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Conversão Geral</p>
                <p className="text-base font-black text-white">{conversionRate}%</p>
              </div>
              <TrendingUp size={18} className="text-[#E3B23C]" />
            </div>
            <Button
              onClick={onLogout}
              className="w-full h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2"
            >
              <LogOut size={16} className="text-slate-400" />
              Sair do CRM
            </Button>
          </div>
        </div>
      )}

      {/* CONTENT REGION (Indented on Desktop for fixed sidebar) */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Desktop Head Banner / Stats */}
        <header className="hidden md:flex bg-white border-b border-slate-200/60 px-8 py-5 items-center justify-between sticky top-0 z-20">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Painel de Desempenho</p>
            <h1 className="text-lg font-black text-slate-950 tracking-tight">
              {activeTab === 'campanha' && "🚀 Central de Campanha"}
              {activeTab === 'crm' && "🎯 Funil de Vendas (CRM)"}
              {activeTab === 'onboarding' && "📊 Funil de Ativação / Onboarding"}
              {activeTab === 'materiais' && "📂 Materiais de Apoio"}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Escolas Indicadas</p>
              <p className="text-sm font-black text-slate-900">{stats?.total_diagnosticos || 0}</p>
            </div>
            {memberRole === 'owner' && (
              <>
                <span className="text-slate-200">|</span>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Comissão Estimada</p>
                  <p className="text-sm font-black text-emerald-600">
                    Kz {totalComissao.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Viewport content injection */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
