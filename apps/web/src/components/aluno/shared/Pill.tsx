import type { ReactNode } from "react";

type PillStatus = "approved" | "warning" | "danger" | "info" | "gold" | "emerald";

type Props = {
  label: string;
  status?: PillStatus;
  colorClass?: string;
  bgClass?: string;
  icon?: ReactNode;
  className?: string;
};

const statusStyles: Record<PillStatus, { color: string; bg: string; border: string }> = {
  approved: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200/60" },
  emerald: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200/60" },
  gold: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200/60" },
  warning: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200/60" },
  danger: { color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200/60" },
  info: { color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200/60" },
};

export function Pill({ label, status, colorClass, bgClass, icon, className = "" }: Props) {
  const preset = status ? statusStyles[status] : null;
  const finalColor = colorClass ?? preset?.color ?? "text-klasse-green-700";
  const finalBg = bgClass ?? preset?.bg ?? "bg-klasse-green-50";
  const finalBorder = preset?.border ?? "border-transparent";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-extrabold tracking-tight border transition-all ${finalColor} ${finalBg} ${finalBorder} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
    </span>
  );
}

