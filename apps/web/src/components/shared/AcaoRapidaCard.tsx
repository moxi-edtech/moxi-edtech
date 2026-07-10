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
    ? "text-[#E3B23C] bg-[#E3B23C]/10"
    : "text-[#1F6B3B] bg-[#1F6B3B]/10";

  const inner = (
    <div className={`relative group flex flex-col items-start gap-2 border border-slate-200 bg-white p-4 transition ${compact ? "rounded-lg hover:shadow-none shadow-none" : "rounded-xl hover:shadow-sm"}`}>
      <div className={`flex items-center justify-center ${compact ? "h-9 w-9 rounded-lg" : "h-10 w-10 rounded-xl"} ${colorClasses}`}>
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
