"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  size?: "compact" | "medium" | "expanded";
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};
const sizes = { compact: "40dvh", medium: "65dvh", expanded: "90dvh" };

/** Radix owns modality, focus trapping and nested dialogs; CSS owns motion. */
export function PortalSheet({ open, onClose, title, description, size = "medium", busy = false, children, footer }: Props) {
  const opener = useRef<HTMLElement | null>(null);
  const header = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !busy) onClose(); }}>
      <DialogContent layout="bottom-sheet" closeButton={false}
        overlayClassName="klasse-portal-theme klasse-academic-dialog klasse-context-sheet-overlay bg-muted-foreground/60"
        style={{ "--portal-sheet-limit": sizes[size] } as CSSProperties}
        className="klasse-portal-theme klasse-academic-dialog klasse-context-sheet gap-0 bg-card text-foreground sm:max-w-xl"
        onOpenAutoFocus={event => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          event.preventDefault();
          header.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={event => {
          if (opener.current?.isConnected && !opener.current.matches(":disabled,[aria-disabled=true]")) {
            event.preventDefault();
            opener.current.focus({ preventScroll: true });
          }
          opener.current = null;
        }}
        onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
        onInteractOutside={event => { if (busy) event.preventDefault(); }}>
        <header className="shrink-0 border-b border-border px-4 pb-3 pt-3">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-8 rounded-full bg-muted-foreground/30" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle ref={header} tabIndex={-1} className="break-words text-lg leading-snug text-primary focus:outline-none">{title}</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">{description}</DialogDescription>
            </div>
            <button type="button" aria-label="Fechar" disabled={busy} onClick={onClose}
              className="klasse-portal-press flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">{children}</div>
        {footer && <footer className="shrink-0 border-t border-border p-4">{footer}</footer>}
      </DialogContent>
    </Dialog>
  );
}
