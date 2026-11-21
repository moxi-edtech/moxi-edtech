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
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        closeButton={false}
        overlayClassName="bg-black/40"
        onPointerDownOutside={(event) => event.preventDefault()}
        className={[
          "flex w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-xl",
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
      </DialogContent>
    </Dialog>
  );
}
