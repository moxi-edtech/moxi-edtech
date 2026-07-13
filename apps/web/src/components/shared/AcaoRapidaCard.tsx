import Link from "next/link";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

type AcaoRapidaCardProps = {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  href?: string;
  onClick?: () => void;
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
  disabled = false,
  disabledReason,
  compact = false,
  variant = "green",
}: AcaoRapidaCardProps) {
  const colorClasses = variant === "yellow"
    ? "bg-klasse-gold/10 text-klasse-gold"
    : "bg-klasse-green/10 text-klasse-green";

  const inner = (
    <div className={`relative group flex flex-col items-start gap-2 border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md rounded-xl`}>
      <div className={`flex items-center justify-center ${compact ? "h-9 w-9 rounded-lg" : "h-10 w-10 rounded-lg"} ${colorClasses}`}>
        {disabled ? <Lock className="h-4 w-4 text-slate-400" /> : icon}
      </div>
      <div>
        {sublabel ? (
          <>
            <p
              className={`text-[10px] font-bold uppercase tracking-widest ${
                disabled ? "text-slate-400" : "text-slate-400"
              }`}
            >
              {label}
            </p>
            <p
              className={`mt-1 text-sm font-semibold leading-snug ${
                disabled ? "text-slate-400" : "text-slate-900"
              }`}
            >
              {sublabel}
            </p>
          </>
        ) : (
          <p className={`text-sm font-semibold leading-snug ${disabled ? "text-slate-400" : "text-slate-900"}`}>
            {label}
          </p>
        )}
      </div>
      {disabled && disabledReason && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full w-48 rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-white opacity-0 group-hover:opacity-100 transition"
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
      <button type="button" onClick={onClick} className="text-left">
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
