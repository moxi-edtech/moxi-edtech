"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { portalMotion } from "./motion-tokens";

/** Reflects the existing save state. Never invents success or delays its announcement. */
export function MotionFeedback({ label, icon, className = "" }: {
  label: string;
  icon: ReactNode;
  className?: string;
}) {
  const previous = useRef(label);
  const iconRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (previous.current === label) return;
    previous.current = label;
    const element = iconRef.current;
    if (!element?.closest(".klasse-academic-mobile") || window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof element.animate !== "function") return;
    const animation = element.animate([{ opacity: 0.55, transform: "translateY(2px)" }, { opacity: 1, transform: "translateY(0)" }], {
      duration: portalMotion.feedback, easing: "cubic-bezier(.2,.8,.2,1)",
    });
    return () => animation.cancel();
  }, [label]);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${className}`}>
      <span ref={iconRef} aria-hidden="true" className="inline-flex shrink-0">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
