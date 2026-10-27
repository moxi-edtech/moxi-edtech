import Link from "next/link";
import type { ReactNode } from "react";

/** Display-only metric; no financial or academic interpretation inside this component. */
export function PortalStatCard({
  label,
  value,
  icon,
  href,
  accessibleLabel,
  className = "",
}: {
  label: string;
  value: number | string | null;
  icon?: ReactNode;
  href?: string;
  accessibleLabel?: string;
  className?: string;
}) {
  const contents = (
    <>
      {icon && <span aria-hidden="true" className="shrink-0 text-muted-foreground">{icon}</span>}
      <span className="min-w-0 text-xs font-medium leading-4 text-muted-foreground sm:text-sm">{label}</span>
      <span className="min-w-0 break-words text-lg font-semibold leading-6 tabular-nums text-foreground sm:text-xl">
        {value === null ? <><span aria-hidden="true">—</span><span className="sr-only">Sem dados</span></> : value}
      </span>
    </>
  );
  const styles = `flex min-h-24 min-w-0 flex-col items-start justify-between gap-1.5 rounded-xl border border-border bg-card px-3 py-3 text-left sm:px-4 ${href ? "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" : ""} ${className}`;
  if (href) return <Link href={href} className={styles} aria-label={accessibleLabel}>{contents}</Link>;
  return <div className={styles} aria-label={accessibleLabel}>{contents}</div>;
}
