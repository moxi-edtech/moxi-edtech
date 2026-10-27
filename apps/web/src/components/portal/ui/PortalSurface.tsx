import type { ReactNode } from "react";

/** Canonical compact surface for contextual portal content.
 * Domain state and authorization remain with each portal, not with the surface.
 */
export function PortalSurface({
  children,
  className = "",
  as: Element = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
}) {
  return (
    <Element className={`min-w-0 rounded-xl border border-border bg-card p-3.5 text-foreground sm:p-4 ${className}`}>
      {children}
    </Element>
  );
}
