"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal, X, IdCard, FileText, Bell, Settings, ChevronRight } from "lucide-react";
import { preloadPortalData } from "../usePortalSWR";

type NavItem = {
  href: string;
  path?: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  preload?: { keys: string[]; urls: string[] };
};

type Props = {
  items: NavItem[];
  activePath: string;
  withAlunoParam: (href: string) => string;
};

export function AlunoBottomNav({ items, activePath, withAlunoParam }: Props) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("aluno") ?? null;

  // Split items into main 4 bar items and drawer items
  const mainItems = items.slice(0, 4); // Início, Horário, Académico, Financeiro
  const drawerItems = items.slice(4); // ID Digital, Documentos, Avisos, Perfil

  const isDrawerActive = drawerItems.some(
    (item) =>
      activePath === item.href ||
      activePath.startsWith(`${item.href}/`) ||
      (item.path ? activePath === item.path || activePath.startsWith(`${item.path}/`) : false)
  );

  const handlePreload = (item: NavItem) => {
    if (!item.preload) return;
    item.preload.keys.forEach((key, idx) => {
      const url = item.preload?.urls[idx];
      if (url) void preloadPortalData(key, url);
    });
  };

  return (
    <>
      {/* Drawer "Mais" (BottomSheet Overlay) */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />
          
          <div className="relative w-full max-w-xl overflow-hidden rounded-t-[2.5rem] bg-white p-6 shadow-2xl ring-1 ring-slate-200 animate-in slide-in-from-bottom duration-300 z-10 pb-[calc(24px+env(safe-area-inset-bottom))]">
            {/* Header do Drawer */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Navegação Extendida</p>
                <h3 className="text-lg font-black text-slate-900">Menu Principal</h3>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Grid de Serviços do Drawer */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {drawerItems.map((item) => {
                const { href, path, label, icon: Icon, badge } = item;
                const active =
                  activePath === href ||
                  activePath.startsWith(`${href}/`) ||
                  (path ? activePath === path || activePath.startsWith(`${path}/`) : false);

                return (
                  <Link
                    key={href}
                    href={withAlunoParam(href)}
                    onClick={() => setIsMoreOpen(false)}
                    onPointerEnter={() => handlePreload(item)}
                    onTouchStart={() => handlePreload(item)}
                    className={`relative flex items-center gap-3 rounded-2xl p-3.5 border transition-all active:scale-95 ${
                      active
                        ? "border-klasse-green bg-klasse-green-50/60 text-klasse-green shadow-sm"
                        : "border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100/80"
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      active ? "bg-klasse-green text-white" : "bg-white text-slate-600 shadow-sm"
                    }`}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black truncate">{label}</p>
                    </div>
                    {badge && badge > 0 ? (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                        {badge}
                      </span>
                    ) : (
                      <ChevronRight size={14} className="text-slate-300" />
                    )}
                  </Link>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur shadow-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegação do portal do aluno"
      >
        <div className="mx-auto grid w-full max-w-5xl grid-cols-5 gap-1 px-2 py-1.5">
          {/* Main 4 Items */}
          {mainItems.map((item) => {
            const { href, path, label, icon: Icon, badge } = item;
            const active =
              activePath === href ||
              activePath.startsWith(`${href}/`) ||
              (path ? activePath === path || activePath.startsWith(`${path}/`) : false);
            return (
              <Link
                key={href}
                href={withAlunoParam(href)}
                prefetch
                onPointerEnter={() => handlePreload(item)}
                onTouchStart={() => handlePreload(item)}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-[10px] font-black transition-all duration-200 active:scale-90 ${
                  active
                    ? "text-klasse-green scale-105"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                  active ? "bg-klasse-green-50 shadow-sm" : "bg-transparent"
                }`}>
                  <Icon className={`h-5 w-5 transition-all ${active ? "fill-current" : ""}`} />
                </div>
                <span className={`transition-opacity duration-200 ${active ? "opacity-100" : "opacity-70"}`}>
                  {label}
                </span>
                {badge && badge > 0 && (
                  <span className="absolute right-3 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-sm">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* 5th Item: "Mais" Button */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className={`relative flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-[10px] font-black transition-all duration-200 active:scale-90 ${
              isDrawerActive || isMoreOpen
                ? "text-klasse-green scale-105"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
              isDrawerActive || isMoreOpen ? "bg-klasse-green-50 shadow-sm" : "bg-transparent"
            }`}>
              <MoreHorizontal className="h-5 w-5" />
            </div>
            <span className={`transition-opacity duration-200 ${isDrawerActive || isMoreOpen ? "opacity-100" : "opacity-70"}`}>
              Mais
            </span>
            {drawerItems.some(i => (i.badge ?? 0) > 0) && (
              <span className="absolute right-3 top-1 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
