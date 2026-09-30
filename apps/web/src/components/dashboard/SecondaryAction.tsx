import Link from "next/link";

export function SecondaryAction({
  icon: Icon,
  label,
  href,
  highlight,
}: {
  icon: any;
  label: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        flex flex-col items-center gap-2 p-3 rounded-xl border transition
        ${highlight
          ? "bg-amber/5 border-amber/30 text-amber"
          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}
      `}
    >
      <Icon className={`h-5 w-5 ${highlight ? "text-amber" : "text-slate-400"}`} />
      <span className="text-[11px] font-semibold">{label}</span>
    </Link>
  );
}
