import type { ReactNode } from "react";

type CardVariant = "default" | "glass" | "hero" | "subtle";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
  onClick?: () => void;
};

const variantStyles: Record<CardVariant, string> = {
  default: "border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]",
  glass: "border-white/20 bg-white/70 backdrop-blur-md shadow-[0_4px_20px_rgba(15,23,42,0.05)]",
  hero: "border-[#1f4028] bg-gradient-to-br from-[#0d1f12] via-[#12321d] to-[#1f4028] text-white shadow-[0_8px_30px_rgba(13,31,18,0.25)]",
  subtle: "border-slate-100 bg-slate-50/80 shadow-none",
};

export function AlunoCard({ children, className = "", variant = "default", onClick }: Props) {
  const baseVariant = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${baseVariant} ${
        onClick
          ? "cursor-pointer active:scale-[0.99] hover:-translate-y-0.5 hover:border-emerald-600/30 hover:shadow-[0_8px_24px_rgba(22,163,74,0.08)]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

