"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Settings } from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificacoesDropdown } from "@/components/ui/NotificacoesDropdown";
import { ModuleSwitcherInner } from "@/components/layout/klasse/ModuleSwitcher";
import LockScreenButton from "@/components/session/LockScreenButton";
import { requestSessionConfig } from "@/components/session/SessionLockProvider";
import { GlobalSearchActionSheet } from "@/components/GlobalSearchActionSheet";
import type { MinimalSearchResult, SearchAction } from "@/hooks/useGlobalSearch";

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

type TopbarProps = {
  portalTitle?: string;
  portalSubtitle?: string;
  userName?: string | null;
  contextLabel?: string;
  escolaNome?: string | null;
  planoNome?: string | null;
  escolaId?: string | null;
  escolaParam?: string | null;
  portal?: "secretaria" | "financeiro" | "admin" | "operacoes" | "professor" | "aluno" | "gestor" | "superadmin";
};

export default function Topbar({
  portalTitle = "Portal",
  portalSubtitle = "MoxiNexa",
  userName,
  contextLabel: _contextLabel = "Dashboard",
  escolaNome: _escolaNome,
  planoNome: _planoNome,
  escolaId,
  escolaParam,
  portal,
}: TopbarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSearchAction, setActiveSearchAction] = useState<{
    action: SearchAction;
    result: MinimalSearchResult;
  } | null>(null);
  const userInitial =
    (userName || portalSubtitle || "U")
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  return (
    <>
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="h-16 flex items-center gap-4 px-4">
        {/* Search */}
        <div className="hidden md:flex w-[420px]">
          <CommandPalette
            escolaId={escolaId}
            portal={portal}
            onAction={
              portal === "operacoes"
                ? (action, result) => setActiveSearchAction({ action, result })
                : undefined
            }
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ModuleSwitcherInner escolaId={escolaId} escolaParam={escolaParam} />
          <NotificacoesDropdown />
          <LockScreenButton
            iconOnly
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
          />

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
                <span className="text-[11px] font-bold text-klasse-green-900">{userInitial}</span>
              </div>
              <div className="hidden sm:block text-left leading-4">
                <div className="text-sm font-medium text-slate-900">{portalTitle}</div>
                <div className="text-xs text-slate-500">{userName || portalSubtitle}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-2 space-y-0.5">
                <LockScreenButton className="flex w-full items-center justify-start gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50" />
                
                <button
                  onClick={() => {
                    requestSessionConfig();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-start gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  Preferências de Sessão
                </button>

                <div className="my-1 border-t border-slate-100" />
                
                <SignOutButton
                  label="Sair"
                  className="w-full justify-start gap-2 text-slate-700 hover:bg-slate-50 py-1.5"
                  variant="ghost"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    {escolaId ? (
      <GlobalSearchActionSheet
        active={activeSearchAction}
        escolaId={escolaId}
        onClose={() => setActiveSearchAction(null)}
        onSuccess={() => router.refresh()}
      />
    ) : null}
    </>
  );
}
