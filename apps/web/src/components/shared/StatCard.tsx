import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type Tone = "default" | "warning" | "critical";

type StatCardProps = {
  label: string;
  value: number | string | null | undefined;
  icon: ReactNode;
  href?: string;
  tone?: Tone;
  disabled?: boolean;
  animateValue?: boolean;
};

const toneStyles: Record<Tone, { iconBg: string; iconText: string; valueText: string; border: string }> = {
  default: {
    iconBg: "bg-[#1F6B3B]/10",
    iconText: "text-[#1F6B3B]",
    valueText: "text-[#1F6B3B]",
    border: "border-[#1F6B3B]/15",
  },
  warning: {
    iconBg: "bg-[#E3B23C]/15",
    iconText: "text-[#9a7010]",
    valueText: "text-[#9a7010]",
    border: "border-[#E3B23C]/30",
  },
  critical: {
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
    valueText: "text-rose-600",
    border: "border-rose-200",
  },
};

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    const timer = setTimeout(() => {
      const start = performance.now();

      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(ease * target));
        if (p < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }, delay);

    return () => clearTimeout(timer);
  }, [target, duration, delay]);

  return val;
}

export default function StatCard({
  label,
  value,
  icon,
  href,
  tone = "default",
  disabled = false,
  animateValue = false,
}: StatCardProps) {
  const toneStyle = toneStyles[tone];
  const isNumericValue = typeof value === "number" && Number.isFinite(value);
  const animatedValue = useCountUp(isNumericValue && animateValue ? value : 0);

  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
        disabled ? "opacity-60" : "hover:shadow-md"
      } ${toneStyle.border}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneStyle.iconBg} ${toneStyle.iconText}`}
          >
            {icon}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {label}
          </span>
        </div>
        {href && !disabled && (
          <Link href={href} className="text-[10px] font-semibold text-[#1F6B3B] hover:underline">
            Ver todos
          </Link>
        )}
      </div>
      <div className={`mt-3 text-2xl font-black ${toneStyle.valueText}`}>
        {isNumericValue ? (animateValue ? animatedValue.toLocaleString("pt-AO") : value.toLocaleString("pt-AO")) : (value ?? "—")}
      </div>
    </div>
  );
}
