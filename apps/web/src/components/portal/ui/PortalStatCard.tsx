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
  tone = "neutral",
}: {
  label: string;
  value: number | string | null;
  icon?: ReactNode;
  href?: string;
  accessibleLabel?: string;
  className?: string;
  tone?: "neutral" | "info" | "success" | "warning";
}) {
  const palette = {
    neutral: { surface: "border-border bg-card", icon: "bg-muted text-muted-foreground", text: "text-foreground" },
    info: { surface: "border-blue-100 bg-blue-50", icon: "bg-blue-100 text-blue-800", text: "text-blue-900" },
    success: { surface: "border-emerald-100 bg-emerald-50", icon: "bg-emerald-100 text-emerald-800", text: "text-emerald-900" },
    warning: { surface: "border-amber-200 bg-amber-50", icon: "bg-amber-100 text-amber-800", text: "text-amber-900" },
  }[tone];
  const contents = (
    <>
      {icon && <span aria-hidden="true" className={tone === "neutral" ? "shrink-0 text-muted-foreground" : `flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${palette.icon}`}>{icon}</span>}
      <span className={`min-w-0 text-xs font-medium leading-4 sm:text-sm ${tone === "neutral" ? "text-muted-foreground" : palette.text}`}>{label}</span>
      <span className={`min-w-0 break-words text-lg font-semibold leading-6 tabular-nums sm:text-xl ${palette.text}`}>
        {value === null ? <><span aria-hidden="true">—</span><span className="sr-only">Sem dados</span></> : value}
      </span>
    </>
  );
  const styles = `flex min-h-24 min-w-0 flex-col items-start justify-between gap-1.5 rounded-xl border text-left sm:px-4 ${tone === "neutral" ? "px-3 py-3" : "px-2.5 py-2.5"} ${palette.surface} ${href ? "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" : ""} ${href ? (tone === "neutral" ? "hover:bg-muted" : "hover:brightness-95") : ""} ${className}`;
  if (href) return <Link href={href} className={styles} aria-label={accessibleLabel}>{contents}</Link>;
  return <div className={styles} aria-label={accessibleLabel}>{contents}</div>;
}
