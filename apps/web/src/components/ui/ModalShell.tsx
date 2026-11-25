"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type ModalShellProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "default" | "wide";
  mobileFullscreen?: boolean;
  onRestoreFocus?: () => void;
};

/** API-compatible modal; Radix handles focus, Escape and scroll locking. */
export function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "default",
  mobileFullscreen = false,
  onRestoreFocus,
}: ModalShellProps) {
  const [viewport,setViewport]=useState<{height:number;top:number}|null>(null);
  useEffect(()=>{
    if(!open||!mobileFullscreen)return;
    const vv=window.visualViewport;
    const small=window.matchMedia("(max-width: 639px)");
    const sync=()=>setViewport(small.matches&&vv&&vv.scale===1?{height:vv.height,top:vv.offsetTop}:null);
    sync();
    vv?.addEventListener("resize",sync);
    vv?.addEventListener("scroll",sync);
    small.addEventListener("change",sync);
    return()=>{vv?.removeEventListener("resize",sync);vv?.removeEventListener("scroll",sync);small.removeEventListener("change",sync);};
  },[open,mobileFullscreen]);
  // The focus scope spans the viewport. The base DialogContent animations use transforms,
  // which create a containing block even with zero translation, so disable them here.
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        layout="viewport"
        closeButton={false}
        overlayClassName="bg-black/40"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          // Escape from the nested Balcão must be handled by its draft-aware close guard.
          if ((event.target as HTMLElement | null)?.closest?.("[data-balcao-workspace-modal]")) {
            event.preventDefault();
          }
        }}
        onCloseAutoFocus={onRestoreFocus?event=>{event.preventDefault();onRestoreFocus();}:undefined}
        style={mobileFullscreen&&viewport?{height:viewport.height,top:viewport.top,bottom:"auto"}:undefined}
        className={mobileFullscreen?"gap-0 border-0 bg-transparent p-0 shadow-none sm:p-6":"gap-0 border-0 bg-transparent p-4 shadow-none sm:p-6"}
      >
        <section
          className={[
            "flex w-full max-h-full min-h-0 flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-xl",
            mobileFullscreen ? "max-sm:h-full max-sm:rounded-none max-sm:border-0" : "",
            size === "wide" ? "max-w-7xl" : "max-w-3xl",
          ].join(" ")}
        >
          <div className={mobileFullscreen?"flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-4 sm:px-6 sm:py-4":"flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6"}>
            <div className="min-w-0">
              <DialogTitle className="break-words text-lg font-semibold text-foreground">{title}</DialogTitle>
              <DialogDescription className={description ? "mt-1 text-xs text-muted-foreground" : "sr-only"}>
                {description ?? title}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
            >
              Fechar
            </button>
          </div>
          <div className={mobileFullscreen?"min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-6 sm:py-5":"min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"}>{children}</div>
          {footer ? <div className={mobileFullscreen?"max-h-[38%] shrink-0 overflow-y-auto border-t border-border bg-muted px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:max-h-none sm:px-6 sm:py-4":"shrink-0 border-t border-border bg-muted px-4 py-4 sm:px-6"}>{footer}</div> : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}
