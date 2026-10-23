"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Settings } from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";
import { CommandPalette } from "@/components/CommandPalette";
import { BalcaoWorkspace } from "@/components/secretaria/BalcaoWorkspace";
import { NotificacoesDropdown } from "@/components/ui/NotificacoesDropdown";
import LockScreenButton from "@/components/session/LockScreenButton";
import { requestSessionConfig } from "@/components/session/SessionLockProvider";
import { clearExplorerReturnContext } from "@/lib/command-center/explorer-return-context";
import ThemeToggle from "@/components/ThemeToggle";

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

type TopbarProps = {
  portalTitle?: string;
  portalSubtitle?: string;
  userName?: string | null;
  userScope?: string | null;
  poloScope?: string;
  contextLabel?: string;
  escolaNome?: string | null;
  planoNome?: string | null;
  escolaId?: string | null;
  escolaParam?: string | null;
  portal?: "secretaria" | "financeiro" | "admin" | "operacoes" | "professor" | "aluno" | "gestor" | "superadmin";
};

function ScopedTopbar({
  portalTitle = "Portal",
  portalSubtitle = "MoxiNexa",
  userName,
  userScope,
  poloScope = "-",
  contextLabel: _contextLabel = "Dashboard",
  escolaNome: _escolaNome,
  planoNome: _planoNome,
  escolaId,
  portal,
}: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [restoreExplorerOnOpen, setRestoreExplorerOnOpen] = useState(false);
  const [selectedSearchStudent, setSelectedSearchStudent] = useState<{
    id: string;
    label: string;
    schoolId: string;
  } | null>(null);

  // A scope switch unmounts this keyed instance. The React states are
  // initialised afresh, rather than synchronously reset in an effect.
  useEffect(() => () => clearExplorerReturnContext(), []);

  const userInitial =
    (userName || portalSubtitle || "U")
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  return (
    <>

      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex h-16 items-center gap-3 px-3 sm:gap-4 sm:px-4">
          <div className="hidden min-w-0 md:block md:w-[clamp(230px,27vw,420px)]">
            <button
              type="button"
              onClick={() => {
                setRestoreExplorerOnOpen(false);
                setPaletteOpen(true);
              }}
              className="group relative flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-amber/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <Search className="h-4 w-4 text-slate-400 group-hover:text-slate-500" aria-hidden />
              <span className="flex-1 text-left">Pesquisar ou digitar acção...</span>
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100 sm:flex dark:border-slate-700 dark:bg-slate-800">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          <div className="md:hidden">
            <button
              type="button"
              onClick={() => {
                setRestoreExplorerOnOpen(false);
                setPaletteOpen(true);
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-amber/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              aria-label="Pesquisar ou abrir Command Center"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <CommandPalette
            escolaId={escolaId}
            portal={portal}
            open={paletteOpen}
            onOpenChange={(next) => {
              setPaletteOpen(next);
              if (!next) setRestoreExplorerOnOpen(false);
            }}
            hideTrigger
            restoreExplorerOnOpen={restoreExplorerOnOpen}
            onStudentSelect={(student) => {
              if (escolaId) setSelectedSearchStudent({ ...student, schoolId: escolaId });
            }}
          />

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificacoesDropdown />
            <LockScreenButton
              iconOnly
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-amber/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            />

            <div className="relative">
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3",
                  "hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-amber/20",
                  "dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                )}
                aria-label={`Menu do usuário - ${portalTitle}`}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald/15 ring-1 ring-emerald/25">
                  <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-100">{userInitial}</span>
                </div>
                <div className="hidden text-left leading-4 sm:block">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{portalTitle}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{userName || portalSubtitle}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 space-y-0.5 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <LockScreenButton className="flex w-full items-center justify-start gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" />

                  <button
                    onClick={() => {
                      requestSessionConfig();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-start gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    Preferências de Sessão
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                  <SignOutButton
                    label="Sair"
                    className="w-full justify-start gap-2 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    variant="ghost"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {typeof document !== "undefined" && userScope && escolaId && selectedSearchStudent?.schoolId === escolaId && (portal === "operacoes" || portal === "secretaria" || portal === "admin") ? createPortal(
        <BalcaoWorkspace
          key={`${userScope}:${escolaId}:${poloScope}:${selectedSearchStudent.id}`}
          userScope={userScope}
          poloScope={poloScope}
          open
          escolaId={escolaId}
          aluno={selectedSearchStudent}
          onClose={() => {
            setSelectedSearchStudent(null);
            // UX-00: reabrir explorador se havia contexto guardado ao sair para o Balcão
            setRestoreExplorerOnOpen(true);
            setPaletteOpen(true);
          }}
        />,
        document.body,
      ) : null}
    </>
  );
}


/** Isolation boundary for a logged-in operator and a school/polo. Unlike an
 * effect-driven reset, remounting guarantees no earlier student's UI state
 * survives a tenant/role change before the first paint. */
export default function Topbar(props: TopbarProps) {
  const scope = [props.userScope ?? "-", props.escolaId ?? "-", props.poloScope ?? "-"].join(":");
  return <ScopedTopbar key={scope} {...props} />;
}
