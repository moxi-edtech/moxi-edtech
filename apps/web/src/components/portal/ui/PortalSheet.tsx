"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { ArrowLeft, X } from "lucide-react";
import { readMotionDuration } from "@/components/portal/motion/motion-tokens";
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
  closeLabel?: string;
  contentId?: string;
  onBack?: () => void;
  navigationKey?: string;
  bodyRef?: Ref<HTMLDivElement>;
};
const sizes = { compact: "40dvh", medium: "65dvh", expanded: "90dvh" };

/** Radix owns modality, focus trapping and nested dialogs; CSS owns motion. */
export function PortalSheet({ open, onClose, title, description, size = "medium", busy = false, children, footer, closeLabel = "Fechar", contentId, onBack, navigationKey, bodyRef }: Props) {
  const opener = useRef<HTMLElement | null>(null);
  const header = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [retained, setRetained] = useState(open);
  const present = open || retained;
  const closing = !open && retained;
  useLayoutEffect(() => {
    if (open) { setRetained(true); return; }
    if (!retained) return;
    // Preserve focus inside the dialog even when the closing control is disabled.
    header.current?.focus({ preventScroll: true });
    const duration = content.current ? readMotionDuration(content.current, "sheet") : 0;
    if (!duration) { setRetained(false); return; }
    const fallback = window.setTimeout(() => setRetained(false), duration + 80);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => { if (preference.matches) setRetained(false); };
    preference.addEventListener("change", changed);
    return () => { window.clearTimeout(fallback); preference.removeEventListener("change", changed); };
  }, [open, retained]);
  useLayoutEffect(() => {
    if (open && navigationKey) header.current?.focus({ preventScroll: true });
  }, [open, navigationKey]);
  const requestClose = () => {
    if (busy || closing || !open) return;
    // Move focus before the initiating pointer event can blur a control.
    header.current?.focus({ preventScroll: true });
    onClose();
  };
  return (
    <Dialog open={present} onOpenChange={next => { if (!next && !busy && !closing) requestClose(); }}>
      <DialogContent ref={content} layout="bottom-sheet" closeButton={false} {...(contentId ? { id: contentId } : {})} aria-modal="true"
        data-motion-state={closing ? "closing" : "open"}
        onAnimationEnd={event => { if (event.target === event.currentTarget && closing && event.animationName === "klasse-context-sheet-exit") setRetained(false); }}
        onClickCapture={event => { if (closing) { event.preventDefault(); event.stopPropagation(); } }}
        overlayClassName={"klasse-portal-theme klasse-academic-dialog klasse-context-sheet-overlay bg-muted-foreground/60" + (closing ? " klasse-context-sheet-overlay-closing" : "")}
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
        onEscapeKeyDown={event => { event.preventDefault(); requestClose(); }}
        onPointerDownOutside={event => {
          // Own the outside dismissal so Radix/browser cannot move focus out
          // before React commits the retained closing state.
          event.preventDefault();
          if (event.detail.originalEvent.cancelable) event.detail.originalEvent.preventDefault();
          if (busy || closing) header.current?.focus({ preventScroll: true });
          else requestClose();
        }}
        onFocusOutside={event => { event.preventDefault(); if (busy || closing) header.current?.focus({ preventScroll: true }); }}
        onInteractOutside={event => { if (busy || closing) event.preventDefault(); }}>
        <header className="shrink-0 border-b border-border px-4 pb-3 pt-3">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-8 rounded-full bg-muted-foreground/30" />
          <div className="flex items-start justify-between gap-3">
            {onBack && <button type="button" onClick={onBack} disabled={busy || closing} className="klasse-portal-press flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft size={18} aria-hidden="true" />Voltar</button>}
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle ref={header} tabIndex={-1} className="break-words text-lg leading-snug text-primary focus:outline-none">{title}</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">{description}</DialogDescription>
            </div>
            <button type="button" aria-label={closeLabel} aria-disabled={busy || closing} disabled={busy} onClick={requestClose}
              className="klasse-portal-press flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-disabled:opacity-50">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div ref={bodyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">{children}</div>
        {footer && <footer className="shrink-0 border-t border-border p-4">{footer}</footer>}
      </DialogContent>
    </Dialog>
  );
}
