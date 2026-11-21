"use client";

import type { ReactNode } from "react";
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
}: ModalShellProps) {
  // The focus scope spans the viewport. The base DialogContent animations use transforms,
  // which create a containing block even with zero translation, so disable them here.
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        closeButton={false}
        overlayClassName="bg-black/40"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          // Escape from the nested Balcão must be handled by its draft-aware close guard.
          if ((event.target as HTMLElement | null)?.closest?.("[data-balcao-workspace-modal]")) {
            event.preventDefault();
          }
        }}
        className="fixed inset-0 left-0 top-0 z-50 flex h-[100dvh] w-full max-h-none max-w-none !transform-none !animate-none items-center justify-center gap-0 border-0 bg-transparent p-4 shadow-none sm:p-6"
      >
        <section
          className={[
            "flex w-full max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-xl",
            size === "wide" ? "max-w-7xl" : "max-w-3xl",
          ].join(" ")}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground">{title}</DialogTitle>
              <DialogDescription className={description ? "mt-1 text-xs text-muted-foreground" : "sr-only"}>
                {description ?? title}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20"
            >
              Fechar
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>
          {footer ? <div className="shrink-0 border-t border-border bg-muted px-4 py-4 sm:px-6">{footer}</div> : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}
