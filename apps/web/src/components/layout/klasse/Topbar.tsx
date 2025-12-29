"use client";

import { useState } from "react";
import { Bell, Search, ChevronDown } from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

type TopbarProps = {
  portalTitle?: string;
  portalSubtitle?: string;
};

export default function Topbar({ portalTitle = "Portal", portalSubtitle = "MoxiNexa" }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="h-16 flex items-center gap-3 px-4">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 w-[420px]">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            id="search"
            name="search"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            placeholder="Pesquisar alunos, turmas, faturas..."
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            className={cn(
              "h-10 w-10 rounded-xl border border-slate-200 bg-white",
              "hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
            )}
            aria-label="Notificações"
          >
            <Bell className="mx-auto h-5 w-5 text-slate-600" />
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-10",
                "hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
              )}
              aria-label={`Menu do usuário - ${portalTitle}`}
            >
              <div className="h-7 w-7 rounded-full bg-klasse-green/15 ring-1 ring-klasse-green/25 flex items-center justify-center">
                <span className="text-xs font-semibold text-klasse-green">K</span>
              </div>
              <div className="hidden sm:block text-left leading-4">
                <div className="text-sm font-medium text-slate-900">{portalTitle}</div>
                <div className="text-xs text-slate-500">{portalSubtitle}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg p-2">
                <SignOutButton
                  label="Sair"
                  className="w-full justify-start gap-2 text-slate-700 hover:bg-slate-50"
                  variant="ghost"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
