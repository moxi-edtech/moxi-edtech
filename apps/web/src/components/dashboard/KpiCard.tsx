"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

type KpiCardProps = {
  label: string;
  value?: string | number;
  icon: any;
  variant?: "default" | "brand" | "warning" | "success";
  trend?: {
    value: number;
    isPositive: boolean;
  };
  chartData?: { value: number }[];
  description?: string;
  href?: string;
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
      chart: "#1F6B3B", // klasse-green
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
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black tracking-tight ${styles.value}`}>
              {value ?? "—"}
            </span>
            {trend && (
              <div
                className={`flex items-center gap-0.5 text-xs font-bold ${
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
            <p className="text-[10px] text-slate-400 font-medium leading-none">
              {description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-sm ${styles.icon}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          {href && (
            <div className="text-[10px] font-bold text-[#1F6B3B] uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Ver Detalhes <ArrowRight className="h-2.5 w-2.5" />
            </div>
          )}
        </div>
      </div>

      {chartData && (
        <div className="absolute inset-x-0 bottom-0 h-10 opacity-30 pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
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

  const containerClasses = `group relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between transition hover:shadow-md ${styles.box}`;

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
