import Link from "next/link";
import { operationalCardTone, operationalCardIconClasses } from "@/lib/ui/operational-card-tone";
import type { ReactNode, Ref } from "react";
import { ChevronRight, Lock } from "lucide-react";

type AcaoRapidaCardProps = {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  href?: string;
  onClick?: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  dialogOpen?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  compact?: boolean;
  dashboardCompact?: boolean;
  /** A confirmed operational pending item, independent of the legacy static variant. */
  needsAttention?: boolean;
  variant?: "green" | "yellow";
};

export default function AcaoRapidaCard({
  icon,
  label,
  sublabel,
  href,
  onClick,
  buttonRef,
  dialogOpen,
  disabled = false,
  disabledReason,
  compact = false,
  dashboardCompact = false,
  needsAttention = false,
  variant = "green",
}: AcaoRapidaCardProps) {
  const colorClasses = variant === "yellow"
    ? "bg-amber/10 text-amber dark:text-amber-300"
    : "bg-emerald/10 text-emerald dark:text-emerald-300";

  if (dashboardCompact) {
    const tone = operationalCardTone({ unavailable: disabled, needsAttention });
    const className = "group flex h-full min-h-[80px] w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
    const content = (
      <>
        <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&>svg]:size-4 ${operationalCardIconClasses[tone]}`}>
          {disabled ? <Lock className="h-4 w-4" /> : icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-snug text-foreground">{label}</span>
          {sublabel && <span className="mt-1 block text-xs leading-snug text-muted-foreground">{sublabel}</span>}
          {disabled && disabledReason && <span className="mt-1 block text-xs leading-snug text-muted-foreground">{disabledReason}</span>}
        </span>
        {!disabled && (href || onClick) && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />}
      </>
    );
    if (disabled) return <div aria-disabled="true" className={className + " opacity-60"}>{content}</div>;
    if (onClick) return <button ref={buttonRef} type="button" onClick={onClick} aria-haspopup={dialogOpen !== undefined ? "dialog" : undefined} aria-expanded={dialogOpen} className={className + " hover:border-ring"}>{content}</button>;
    if (href) return <Link href={href} className={className + " hover:border-ring"}>{content}</Link>;
    return <div className={className}>{content}</div>;
  }

  const inner = (
    <div className={`relative group flex flex-col items-start gap-2 border border-border bg-card p-4 shadow-sm transition hover:border-ring hover:shadow-md rounded-xl`}>
      <div className={`flex items-center justify-center ${compact ? "h-9 w-9 rounded-lg" : "h-10 w-10 rounded-lg"} ${colorClasses}`}>
        {disabled ? <Lock className="h-4 w-4 text-muted-foreground" /> : icon}
      </div>
      <div>
        {sublabel ? (
          <>
            <p
              className={`text-[10px] font-bold uppercase tracking-widest ${
                disabled ? "text-muted-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </p>
            <p
              className={`mt-1 text-sm font-semibold leading-snug ${
                disabled ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {sublabel}
            </p>
          </>
        ) : (
          <p className={`text-sm font-semibold leading-snug ${disabled ? "text-muted-foreground" : "text-foreground"}`}>
            {label}
          </p>
        )}
      </div>
      {disabled && disabledReason && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full w-48 rounded-lg bg-klasse-dark px-3 py-2 text-[11px] text-white opacity-0 group-hover:opacity-100 transition"
        >
          {disabledReason}
        </div>
      )}
    </div>
  );

  if (disabled) {
    return <div className="cursor-not-allowed">{inner}</div>;
  }

  if (onClick) {
    return (
      <button ref={buttonRef} type="button" onClick={onClick} aria-haspopup={dialogOpen !== undefined ? "dialog" : undefined} aria-expanded={dialogOpen} className="text-left">
        {inner}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}
