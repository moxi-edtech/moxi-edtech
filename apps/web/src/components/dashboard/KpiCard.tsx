export function KpiCard({
  label,
  value,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value?: number;
  icon: any;
  variant?: "default" | "brand" | "warning" | "success";
}) {
  const styles = {
    default: {
      box: "bg-white border-slate-200",
      icon: "bg-slate-100 text-slate-600",
      value: "text-slate-900",
    },
    brand: {
      box: "bg-white border-slate-200",
      icon: "bg-klasse-green/10 text-klasse-green ring-1 ring-klasse-green/20",
      value: "text-klasse-green",
    },
    warning: {
      box: "bg-klasse-gold/5 border-klasse-gold/30",
      icon: "bg-klasse-gold/15 text-klasse-gold ring-1 ring-klasse-gold/25",
      value: "text-klasse-gold",
    },
    success: {
      box: "bg-white border-slate-200",
      icon: "bg-emerald-100 text-emerald-700",
      value: "text-emerald-700",
    },
  }[variant];

  return (
    <div className={`rounded-xl border p-4 h-24 flex flex-col justify-between transition hover:shadow-sm ${styles.box}`}>
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${styles.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <span className={`text-2xl font-semibold ${styles.value}`}>{value ?? "—"}</span>
    </div>
  );
}
