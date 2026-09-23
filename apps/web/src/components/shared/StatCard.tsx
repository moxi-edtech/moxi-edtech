import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type Tone = "default" | "warning" | "critical";

type StatCardProps = {
  label: string;
  value: number | string | null | undefined;
  icon: ReactNode;
  href?: string;
  /**
   * Torna o cartão accionável (ex.: abrir um modal). Aditivo: quem não passa
   * onClick continua a receber exactamente o mesmo <div> de antes.
   */
  onClick?: () => void;
  tone?: Tone;
  disabled?: boolean;
  animateValue?: boolean;
};

const toneStyles: Record<Tone, { iconBg: string; iconText: string; valueText: string; border: string }> = {
  default: {
    iconBg: "bg-emerald/10",
    iconText: "text-emerald",
    valueText: "text-emerald",
    border: "border-emerald/15",
  },
  warning: {
    iconBg: "bg-amber/15",
    iconText: "text-amber-700",
    valueText: "text-amber-700",
    border: "border-amber/30",
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
  onClick,
  tone = "default",
  disabled = false,
  animateValue = false,
}: StatCardProps) {
  const toneStyle = toneStyles[tone];
  const isNumericValue = typeof value === "number" && Number.isFinite(value);
  const animatedValue = useCountUp(isNumericValue && animateValue ? value : 0);

  const card = (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition ${
        disabled ? "opacity-60" : "hover:shadow-md"
      } ${toneStyle.border}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneStyle.iconBg} ${toneStyle.iconText}`}
          >
            {icon}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {label}
          </span>
        </div>
        {href && !disabled && (
          <Link href={href} className="text-[10px] font-semibold text-emerald hover:underline">
            Ver todos
          </Link>
        )}
      </div>
      <div className={`mt-3 text-2xl font-black ${toneStyle.valueText}`}>
        {isNumericValue ? (animateValue ? animatedValue.toLocaleString("pt-AO") : value.toLocaleString("pt-AO")) : (value ?? "—")}
      </div>
    </div>
  );

  // onClick torna o cartão accionável. O <Link> "Ver todos" só existe quando há
  // href, por isso nunca há um link dentro do botão.
  if (onClick && !disabled && !href) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {card}
      </button>
    );
  }

  return card;
}
