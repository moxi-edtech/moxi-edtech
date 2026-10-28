import type { ReactNode } from "react";
import { PortalSurface } from "./PortalSurface";

/** An informative state, not a warning or compliance panel. One contextual action at most. */
export function PortalEmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <PortalSurface className={`flex items-start gap-3 ${className}`}>
      {icon && <span aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-semibold leading-6 text-foreground">{title}</h3>
        {description && <p className="text-sm leading-5 text-muted-foreground">{description}</p>}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </PortalSurface>
  );
}
