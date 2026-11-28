"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { usePortalDrawerNavigation } from "./PortalDrawerNavigator";

export const PULL_REFRESH_THRESHOLD = 72;
type Phase = "idle" | "pull" | "ready" | "refreshing";
type Props = ComponentPropsWithoutRef<"div"> & {
  onRefresh: () => void | Promise<unknown>;
  busy?: boolean;
  disabled?: boolean;
};

function modalOpen() {
  return Array.from(document.querySelectorAll('[role="dialog"], dialog[open]')).some(element =>
    element.getClientRects().length > 0 && !element.closest('[hidden], [aria-hidden="true"]'));
}
function atScrollTop(target: Element) {
  if ((document.scrollingElement?.scrollTop ?? 0) > 1) return false;
  for (let node: Element | null = target; node; node = node.parentElement) {
    if (node.scrollTop > 1) return false;
  }
  return true;
}

/** Deliberate mobile-only GET refresh. Drawers retain their exclusive dismissal gesture. */
export function PortalPullToRefresh({ onRefresh, busy = false, disabled = false, children, ...props }: Props) {
  const navigation = usePortalDrawerNavigation();
  const enabled = !navigation && !disabled;
  const surface = useRef<HTMLDivElement>(null);
  const current = useRef({ onRefresh, busy, enabled });
  current.current = { onRefresh, busy, enabled };
  const inFlight = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (phase === "refreshing" && !busy && !inFlight.current) setPhase("idle");
  }, [busy, phase]);

  useEffect(() => {
    const root = surface.current;
    if (!root || !enabled) return;
    let gesture: { id: number; x: number; y: number; target: Element; distance: number; claimed: boolean } | null = null;
    let mounted = true;
    const reset = () => { gesture = null; if (!inFlight.current) setPhase(previous => previous === "refreshing" ? previous : "idle"); };
    const canStart = () => current.current.enabled && !current.current.busy && !inFlight.current && !modalOpen() && window.matchMedia("(pointer: coarse)").matches && !document.hidden;
    const start = (event: TouchEvent) => {
      reset();
      const target = event.target;
      if (!canStart() || event.touches.length !== 1 || !(target instanceof Element) ||
          target.closest("[data-portal-pull-refresh]") !== root ||
          target.closest('input, textarea, select, button, a, form, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [data-pull-refresh-ignore]') ||
          !atScrollTop(target)) return;
      const touch = event.touches[0];
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, target, distance: 0, claimed: false };
    };
    const move = (event: TouchEvent) => {
      if (!gesture) return;
      if (!canStart() || event.touches.length !== 1 || !atScrollTop(gesture.target)) { reset(); return; }
      const touch = Array.from(event.touches).find(item => item.identifier === gesture?.id);
      if (!touch) { reset(); return; }
      const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
      if (dy <= 0 || Math.abs(dx) > Math.max(8, dy)) { reset(); return; }
      if (dy < 8 && !gesture.claimed) return;
      if (!event.cancelable) { reset(); return; }
      event.preventDefault();
      gesture.claimed = true;
      gesture.distance = dy;
      setPhase(dy >= PULL_REFRESH_THRESHOLD ? "ready" : "pull");
    };
    const end = (event: TouchEvent) => {
      const armed = gesture?.claimed && gesture.distance >= PULL_REFRESH_THRESHOLD &&
        Array.from(event.changedTouches).some(touch => touch.identifier === gesture?.id);
      gesture = null;
      if (!armed || !canStart()) { reset(); return; }
      inFlight.current = true;
      setPhase("refreshing");
      // The existing loader owns authorization, request cancellation and error feedback.
      void Promise.resolve().then(() => current.current.onRefresh()).catch(() => undefined).finally(() => {
        inFlight.current = false;
        if (mounted && !current.current.busy) setPhase("idle");
      });
    };
    root.addEventListener("touchstart", start, { passive: true });
    root.addEventListener("touchmove", move, { passive: false });
    root.addEventListener("touchend", end, { passive: true });
    root.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      mounted = false;
      root.removeEventListener("touchstart", start);
      root.removeEventListener("touchmove", move);
      root.removeEventListener("touchend", end);
      root.removeEventListener("touchcancel", reset);
    };
  }, [enabled]);

  return <div {...props} ref={surface} data-portal-pull-refresh={enabled ? "true" : undefined}>
    {enabled && phase !== "idle" && <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-primary shadow-sm">
        {phase === "refreshing" ? <Loader2 aria-hidden="true" className="h-4 w-4 text-klasse-gold motion-safe:animate-spin" /> : <ArrowDown aria-hidden="true" className="h-4 w-4 text-klasse-gold" />}
        {phase === "refreshing" ? "A actualizar…" : phase === "ready" ? "Solta para actualizar" : "Puxa para actualizar"}
      </span>
    </div>}
    {children}
  </div>;
}
