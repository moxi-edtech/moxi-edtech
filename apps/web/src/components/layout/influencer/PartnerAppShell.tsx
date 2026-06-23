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
  X
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type PartnerAppShellProps = {
  children: React.ReactNode;
  codigo: string;
  memberName: string;
  activeTab: 'campanha' | 'desempenho' | 'materiais';
  setActiveTab: (tab: 'campanha' | 'desempenho' | 'materiais') => void;
  stats: {
    total_diagnosticos: number;
    convertidos: number;
  } | null;
  totalComissao: number;
  countPendente: number;
  onLogout: () => void;
};

export default function PartnerAppShell({
  children,
  codigo,
  memberName,
  activeTab,
  setActiveTab,
  stats,
  totalComissao,
  countPendente,
  onLogout
}: PartnerAppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const conversionRate = stats?.total_diagnosticos
    ? ((stats.convertidos / stats.total_diagnosticos) * 100).toFixed(1)
    : "0.0";

  interface NavigationItem {
    id: 'campanha' | 'desempenho' | 'materiais';
    label: string;
    icon: React.ComponentType<any>;
    badge?: number;
  }

  const navigationItems: NavigationItem[] = [
    { id: 'campanha', label: 'Campanha', icon: Zap },
    { 
      id: 'desempenho', 
      label: 'Funil / CRM', 
      icon: Users,
      badge: countPendente > 0 ? countPendente : undefined 
    },
    { id: 'materiais', label: 'Materiais', icon: FileText }
  ];

  const handleTabClick = (tabId: 'campanha' | 'desempenho' | 'materiais') => {
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
              <Badge className="bg-[#E3B23C]/10 text-[#E3B23C] border border-[#E3B23C]/20 text-[9px] font-bold px-1.5 py-0.5 rounded">
                PARCEIRO
              </Badge>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{codigo}</span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1.5">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
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
            <h1 className="text-sm font-black tracking-tight text-white uppercase">CRM Parceiros</h1>
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
          <nav className="flex-1 p-6 space-y-3">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
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
              {activeTab === 'desempenho' && "📊 Funil de Onboarding / CRM"}
              {activeTab === 'materiais' && "📂 Materiais de Apoio"}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Escolas Indicadas</p>
              <p className="text-sm font-black text-slate-900">{stats?.total_diagnosticos || 0}</p>
            </div>
            <span className="text-slate-200">|</span>
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Comissão Estimada</p>
              <p className="text-sm font-black text-emerald-600">
                Kz {totalComissao.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
              </p>
            </div>
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
