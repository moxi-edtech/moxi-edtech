"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificacoesDropdown } from "@/components/ui/NotificacoesDropdown";
import ModuleSwitcher from "@/components/layout/klasse/ModuleSwitcher";

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
  portal?: "secretaria" | "financeiro" | "admin" | "professor" | "aluno" | "gestor" | "superadmin";
};

export default function Topbar({
  portalTitle = "Portal",
  portalSubtitle = "MoxiNexa",
  userName,
  contextLabel = "Dashboard",
  escolaNome,
  planoNome,
  escolaId,
  portal,
}: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const infoText = portalSubtitle;
  const homeHref =
    portal === "admin" && escolaId ? `/escola/${escolaId}/admin/dashboard`
    : portal === "secretaria" && escolaId ? `/escola/${escolaId}/secretaria/dashboard`
    : portal === "financeiro" && escolaId ? `/escola/${escolaId}/financeiro/dashboards`
    : portal === "professor" ? "/professor"
    : portal === "aluno" ? "/aluno/dashboard"
    : portal === "superadmin" ? "/super-admin"
    : portal === "gestor" ? "/app"
    : "/app";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="h-16 flex items-center gap-4 px-4">
        <Link href={homeHref} className="flex items-center gap-2 min-w-0" aria-label="Ir para a home do portal">
          <div className="h-9 w-9 rounded-xl bg-klasse-gold/15 ring-1 ring-klasse-gold/30 flex items-center justify-center">
            <Image src="/logo-klasse-ui.png" alt="KLASSE" width={20} height={20} className="h-5 w-5 object-contain" />
          </div>
        </Link>

        <div className="hidden lg:flex flex-col min-w-0">
          <span className="text-sm font-semibold text-slate-900">{contextLabel}</span>
          <span className="text-xs text-slate-500 truncate">{infoText}</span>
        </div>

        {/* Search */}
        <div className="hidden md:flex w-[420px]">
          <CommandPalette escolaId={escolaId} portal={portal} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ModuleSwitcher />
          <NotificacoesDropdown />

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
                <Image src="/logo-klasse-ui.png" alt="KLASSE" width={14} height={14} className="h-[14px] w-[14px] object-contain" />
              </div>
              <div className="hidden sm:block text-left leading-4">
                <div className="text-sm font-medium text-slate-900">{portalTitle}</div>
                <div className="text-xs text-slate-500">{userName || portalSubtitle}</div>
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
