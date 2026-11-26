"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
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
};
const sizes = { compact: "40dvh", medium: "65dvh", expanded: "90dvh" };

/** Radix owns modality, focus trapping and nested dialogs; CSS owns motion. */
export function PortalSheet({ open, onClose, title, description, size = "medium", busy = false, children, footer, closeLabel = "Fechar", contentId }: Props) {
  const opener = useRef<HTMLElement | null>(null);
  const header = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [retained, setRetained] = useState(open);
  const present = open || retained;
  const closing = !open && retained;
  useEffect(() => {
    if (open) { setRetained(true); return; }
    if (!retained) return;
    const duration = content.current ? readMotionDuration(content.current, "sheet") : 0;
    if (!duration) { setRetained(false); return; }
    const fallback = window.setTimeout(() => setRetained(false), duration + 80);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => { if (preference.matches) setRetained(false); };
    preference.addEventListener("change", changed);
    return () => { window.clearTimeout(fallback); preference.removeEventListener("change", changed); };
  }, [open, retained]);
  return (
    <Dialog open={present} onOpenChange={next => { if (!next && !busy && !closing) onClose(); }}>
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
        onEscapeKeyDown={event => { if (busy || closing) event.preventDefault(); }}
        onInteractOutside={event => { if (busy || closing) event.preventDefault(); }}>
        <header className="shrink-0 border-b border-border px-4 pb-3 pt-3">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-8 rounded-full bg-muted-foreground/30" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle ref={header} tabIndex={-1} className="break-words text-lg leading-snug text-primary focus:outline-none">{title}</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">{description}</DialogDescription>
            </div>
            <button type="button" aria-label={closeLabel} disabled={busy || closing} onClick={onClose}
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
