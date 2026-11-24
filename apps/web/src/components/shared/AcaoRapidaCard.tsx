import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { Lock } from "lucide-react";

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
  variant = "green",
}: AcaoRapidaCardProps) {
  const colorClasses = variant === "yellow"
    ? "bg-amber/10 text-amber dark:text-amber-300"
    : "bg-emerald/10 text-emerald dark:text-emerald-300";

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
