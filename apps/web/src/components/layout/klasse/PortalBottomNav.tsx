"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { PortalSheet } from "@/components/portal/ui/PortalSheet";


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
  const [isMoreOpen,setIsMoreOpen] = useState(false);
  const dialogId = useId();
  const isDrawerActive = drawerItems.some(item => item.href === activeHref);
  const closeMenu = () => setIsMoreOpen(false);
  useEffect(() => {
    if (!isMoreOpen || !hideOnDesktop) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (mq.matches) setIsMoreOpen(false); };
    mq.addEventListener("change", closeOnDesktop);
    closeOnDesktop();
    return () => mq.removeEventListener("change", closeOnDesktop);
  }, [isMoreOpen, hideOnDesktop]);
  return (
    <>
      <PortalSheet open={isMoreOpen} onClose={closeMenu} title="Outras áreas" description={description ?? "Acede às restantes áreas do portal."} closeLabel="Fechar outras áreas" contentId={dialogId} size="expanded">
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
      </PortalSheet>

      <nav
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
            type="button"
            onClick={() => setIsMoreOpen(true)}
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
