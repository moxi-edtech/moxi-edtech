import Link from "next/link";

export function ActionCard({
  title,
  sub,
  icon: Icon,
  href,
}: {
  title: string;
  sub: string;
  icon: any;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-klasse-green/10 text-klasse-green ring-1 ring-klasse-green/20 group-hover:bg-klasse-green/15">
        <Icon className="h-5 w-5" />
      </div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
    </Link>
  );
}
