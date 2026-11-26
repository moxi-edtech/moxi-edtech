"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal, X, ChevronRight } from "lucide-react";
import { readMotionDuration } from "@/components/portal/motion/motion-tokens";


export type PortalBottomNavItem = {
  href: string;
  label: string;
  compactLabel?: string;
  icon: LucideIcon;
  badge?: number;
  prefetch?: boolean;
};

type Props = {
  mainItems: PortalBottomNavItem[];
  drawerItems: PortalBottomNavItem[];
  activeHref: string | null;
  navigationLabel: string;
  moreLabel: string;
  description?: string;
  hideOnDesktop?: boolean;
  moreIcon?: LucideIcon;
  onPreload?: (item: PortalBottomNavItem) => void;
};

export function PortalBottomNav({ mainItems, drawerItems, activeHref, navigationLabel, moreLabel, description, hideOnDesktop = false, moreIcon: MoreIcon = MoreHorizontal, onPreload }: Props) {
  const [phase, setPhase] = useState<"closed" | "entering" | "open" | "closing">("closed");
  const isMoreOpen = phase !== "closed";
  const wasOpen = useRef(false);
  const dialogId = useId();
  const titleId = useId();
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isDrawerActive = drawerItems.some(item => item.href === activeHref);

  const closeMenu = useCallback(() => {
    const sheet = dialogRef.current;
    const duration = sheet ? readMotionDuration(sheet, "sheet") : 0;
    setPhase(current => current === "closed" || current === "closing" ? current : duration ? "closing" : "closed");
  }, []);

  // Keep the dialog mounted, focus trapped and scroll locked through the exit.
  useEffect(() => {
    if (phase === "entering") {
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setPhase(current => current === "entering" ? "open" : current));
      });
      return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
    }
    if (phase !== "closing") return;
    const sheet = dialogRef.current;
    const duration = sheet ? readMotionDuration(sheet, "sheet") : 0;
    if (!duration) { setPhase("closed"); return; }
    // Fallback for interrupted or suppressed transitionend; buffer is scheduling slack, not a motion token.
    const fallback = window.setTimeout(() => setPhase(current => current === "closing" ? "closed" : current), duration + 80);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => { if (preference.matches) setPhase("closed"); };
    preference.addEventListener("change", onPreference);
    return () => { window.clearTimeout(fallback); preference.removeEventListener("change", onPreference); };
  }, [phase]);

  useEffect(() => {
    if (isMoreOpen) { wasOpen.current = true; return; }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const frame = requestAnimationFrame(() => {
      if (moreButtonRef.current?.offsetParent !== null) moreButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isMoreOpen]);

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
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    const mq = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (hideOnDesktop && mq.matches) setPhase("closed"); };
    mq.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
      mq.removeEventListener("change", closeOnDesktop);
    };
  }, [isMoreOpen, closeMenu, hideOnDesktop]);

  return (
    <>
      {isMoreOpen && (
        <div data-motion-state={phase} className="klasse-portal-motion-overlay fixed inset-0 z-50 flex items-end justify-center bg-muted-foreground/60">
          <button type="button" tabIndex={-1} aria-label="Fechar menu" onClick={closeMenu} className="absolute inset-0 cursor-default" />
          <div
            id={dialogId}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-motion-state={phase}
            onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === "transform" && phase === "closing") setPhase("closed"); }}
            onClickCapture={event => { if (phase === "closing") { event.preventDefault(); event.stopPropagation(); } }}
            className="relative z-10 klasse-portal-drawer klasse-portal-motion-sheet max-h-[85dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-card px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 shadow-lg sm:px-5"
          >
            <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 id={titleId} className="text-base font-semibold text-primary">Outras áreas</h2>
                {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
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
            <div className="grid grid-cols-2 gap-3">
              {drawerItems.map((item) => {
                const { href, label, icon: Icon, badge } = item;
                const active = item.href === activeHref;
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch={item.prefetch}
                    onClick={closeMenu}
                    onPointerEnter={() => onPreload?.(item)}
                    onTouchStart={() => onPreload?.(item)}
                    aria-current={active ? "page" : undefined}
                    className={"klasse-portal-press flex min-h-14 min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 " +
                      (active ? "border-primary/20 bg-accent text-accent-foreground" : "border-border bg-card text-foreground hover:bg-muted")}
                  >
                    <Icon className={"h-5 w-5 shrink-0 " + (active ? "text-accent-foreground" : "text-muted-foreground")} aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-words leading-snug">{label}</span>
                    {badge && badge > 0
                      ? <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold text-background">{badge}</span>
                      : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        inert={isMoreOpen ? true : undefined}
        className="klasse-portal-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label={navigationLabel}
      >
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-5 gap-1 px-2 py-1.5 sm:px-3">
          {mainItems.map((item) => {
            const { href, label, icon: Icon, badge } = item;
            const active = item.href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                prefetch={item.prefetch ?? true}
                onPointerEnter={() => onPreload?.(item)}
                onTouchStart={() => onPreload?.(item)}
                aria-label={badge && badge > 0 ? `${label}, ${badge}` : label}
                aria-current={active ? "page" : undefined}
                className={"klasse-portal-press relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[11px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 " +
                  (active ? "bg-accent text-accent-foreground ring-1 ring-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="max-w-full break-words text-center">{item.compactLabel ?? label}</span>
                {badge && badge > 0 && (
                  <span className="absolute right-1 top-0 rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-background">{badge}</span>
                )}
              </Link>
            );
          })}
          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setPhase(current => current === "closed" ? "entering" : current)}
            aria-label={moreLabel}
            aria-haspopup="dialog"
            aria-controls={isMoreOpen ? dialogId : undefined}
            aria-expanded={isMoreOpen}
            className={"klasse-portal-press relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[11px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 " +
              (isDrawerActive || isMoreOpen ? "bg-accent text-accent-foreground ring-1 ring-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
          >
            <MoreIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
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
