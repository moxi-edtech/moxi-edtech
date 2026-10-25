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
          : "bg-card border-border text-muted-foreground hover:bg-muted"}
      `}
    >
      <Icon className={`h-5 w-5 ${highlight ? "text-amber" : "text-muted-foreground"}`} />
      <span className="text-[11px] font-semibold">{label}</span>
    </Link>
  );
}
