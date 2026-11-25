"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal, X, ChevronRight } from "lucide-react";
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

const matchesRoute = (item: NavItem, activePath: string) =>
  activePath === item.href || activePath.startsWith(item.href + "/") ||
  (item.path ? activePath === item.path || activePath.startsWith(item.path + "/") : false);

export function AlunoBottomNav({ items, activePath, withAlunoParam }: Props) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const mainItems = items.slice(0, 4);
  const drawerItems = items.slice(4);
  const isDrawerActive = drawerItems.some((item) => matchesRoute(item, activePath));

  const handlePreload = (item: NavItem) => {
    if (!item.preload) return;
    item.preload.keys.forEach((key, index) => {
      const url = item.preload?.urls[index];
      if (url) void preloadPortalData(key, url);
    });
  };

  const closeMenu = useCallback(() => {
    setIsMoreOpen(false);
    moreButtonRef.current?.focus();
  }, []);

  // A navegação secundária é uma caixa de diálogo acessível, não uma segunda homepage.
  useEffect(() => {
    if (!isMoreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMoreOpen, closeMenu]);

  return (
    <>
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-muted-foreground/60">
          <button type="button" tabIndex={-1} aria-label="Fechar menu" onClick={closeMenu} className="absolute inset-0 cursor-default" />
          <div
            id="aluno-mais-areas"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="aluno-mais-titulo"
            className="relative z-10 w-full max-w-xl rounded-t-2xl border border-border bg-card px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 shadow-lg sm:px-5"
          >
            <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 id="aluno-mais-titulo" className="text-base font-semibold text-primary">Outras áreas</h2>
              </div>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Fechar outras áreas"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {drawerItems.map((item) => {
                const { href, label, icon: Icon, badge } = item;
                const active = matchesRoute(item, activePath);
                return (
                  <Link
                    key={href}
                    href={withAlunoParam(href)}
                    onClick={() => setIsMoreOpen(false)}
                    onPointerEnter={() => handlePreload(item)}
                    onTouchStart={() => handlePreload(item)}
                    aria-current={active ? "page" : undefined}
                    className={"flex min-h-14 min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 " +
                      (active ? "border-klasse-gold/40 bg-klasse-gold-50 text-klasse-gold-700" : "border-border bg-card text-foreground hover:bg-muted")}
                  >
                    <Icon className={"h-5 w-5 shrink-0 " + (active ? "text-klasse-gold-700" : "text-muted-foreground")} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {badge && badge > 0
                      ? <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold text-white">{badge}</span>
                      : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegação do portal do aluno"
      >
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-5 gap-0.5 px-1 py-1 sm:gap-1 sm:px-2">
          {mainItems.map((item) => {
            const { href, label, icon: Icon, badge } = item;
            const active = matchesRoute(item, activePath);
            return (
              <Link
                key={href}
                href={withAlunoParam(href)}
                prefetch
                onPointerEnter={() => handlePreload(item)}
                onTouchStart={() => handlePreload(item)}
                aria-current={active ? "page" : undefined}
                className={"relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 " +
                  (active ? "bg-klasse-gold-50 text-klasse-gold-700 ring-1 ring-klasse-gold/30" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="max-w-full truncate text-center">{label}</span>
                {badge && badge > 0 && (
                  <span className="absolute right-1 top-0 rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">{badge}</span>
                )}
              </Link>
            );
          })}
          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setIsMoreOpen(true)}
            aria-label="Abrir mais áreas do Portal do Aluno"
            aria-haspopup="dialog"
            aria-controls="aluno-mais-areas"
            aria-expanded={isMoreOpen}
            className={"relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 " +
              (isDrawerActive || isMoreOpen ? "bg-klasse-gold-50 text-klasse-gold-700 ring-1 ring-klasse-gold/30" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
          >
            <MoreHorizontal className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span>Mais</span>
            {drawerItems.some((item) => (item.badge ?? 0) > 0) && (
              <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
