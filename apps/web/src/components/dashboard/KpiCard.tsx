"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { klasseColors } from "@moxi/design-tokens";

type KpiCardProps = {
  label: string;
  value?: string | number;
  icon: LucideIcon;
  variant?: "default" | "brand" | "warning" | "success";
  trend?: {
    value: number;
    isPositive: boolean;
  };
  chartData?: { value: number }[];
  description?: string;
  href?: string;
  compact?: boolean;
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  trend,
  chartData,
  description,
  href,
  compact = false,
}: KpiCardProps) {
  const styles = {
    default: {
      box: "bg-white border-slate-200",
      icon: "bg-slate-100 text-slate-600",
      value: "text-slate-900",
      chart: "#94a3b8", // slate-400
    },
    brand: {
      box: "bg-white border-slate-200",
      icon: "bg-klasse-green/10 text-klasse-green ring-1 ring-klasse-green/20",
      value: "text-klasse-green",
      chart: klasseColors.green.DEFAULT,
    },
    warning: {
      box: "bg-klasse-gold/5 border-klasse-gold/30",
      icon: "bg-klasse-gold/15 text-klasse-gold ring-1 ring-klasse-gold/25",
      value: "text-klasse-gold",
      chart: "#D4AF37", // klasse-gold
    },
    success: {
      box: "bg-white border-slate-200",
      icon: "bg-klasse-green-100 text-klasse-green-700",
      value: "text-klasse-green-700",
      chart: "#15803d", // green-700
    },
  }[variant];

  const Content = (
    <>
      <div className="flex items-start justify-between relative z-10">
        <div className={compact ? "space-y-0.5" : "space-y-1"}>
          <span className={`font-bold uppercase tracking-widest text-slate-400 ${compact ? "text-[10px]" : "text-[11px]"}`}>
            {label}
          </span>
          <div className={`flex items-baseline ${compact ? "gap-1.5" : "gap-2"}`}>
            <span className={`${compact ? "text-[26px]" : "text-2xl"} font-black tracking-tight ${styles.value}`}>
              {value ?? "—"}
            </span>
            {trend && (
              <div
                className={`flex items-center gap-0.5 font-bold ${
                  compact ? "text-[10px]" : "text-xs"
                } ${
                  trend.isPositive ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value}%
              </div>
            )}
          </div>
          {description && (
            <p className={`text-slate-400 font-medium leading-none ${compact ? "text-[9px]" : "text-[10px]"}`}>
              {description}
            </p>
          )}
        </div>
        <div className={`flex flex-col items-end ${compact ? "gap-1.5" : "gap-2"}`}>
          <div
            className={`${compact ? "h-9 w-9 rounded-lg shadow-sm" : "h-10 w-10 rounded-lg shadow-sm"} flex items-center justify-center ${styles.icon}`}
          >
            <Icon className={compact ? "h-4.5 w-4.5" : "h-5 w-5"} />
          </div>
          {href && (
            <div className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-tighter text-klasse-green opacity-0 transition-opacity group-hover:opacity-100">
              Ver Detalhes <ArrowRight className="h-2.5 w-2.5" />
            </div>
          )}
        </div>
      </div>

      {chartData && (
        <div className="absolute inset-x-0 bottom-0 h-10 min-h-10 min-w-px opacity-30 pointer-events-none">
          <ResponsiveContainer width="100%" height={40} minWidth={1} minHeight={1}>
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={styles.chart}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );

  const containerClasses = `group relative min-w-0 overflow-hidden border flex flex-col justify-between transition ${
    compact
      ? "min-h-[112px] rounded-xl p-4 shadow-sm hover:shadow-md"
      : "min-h-[132px] rounded-xl p-5 hover:shadow-md shadow-sm"
  } ${styles.box}`;

  if (href) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link href={href} className={containerClasses}>
          {Content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={containerClasses}
    >
      {Content}
    </motion.div>
  );
}
