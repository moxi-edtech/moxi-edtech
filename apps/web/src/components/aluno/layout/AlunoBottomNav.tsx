import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { preloadPortalData } from "../usePortalSWR";
import { useSearchParams } from "next/navigation";

type NavItem = {
  href: string;
  path?: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  preload?: { keys: string[]; urls: string[] };
};

type Props = {
  items: NavItem[];
  activePath: string;
  withAlunoParam: (href: string) => string;
};

export function AlunoBottomNav({ items, activePath, withAlunoParam }: Props) {
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("aluno") ?? null;

  const handlePreload = (item: NavItem) => {
    if (!item.preload) return;
    
    item.preload.keys.forEach((key, idx) => {
      const url = item.preload?.urls[idx];
      if (url) void preloadPortalData(key, url);
    });
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação do portal do aluno"
    >
      <div className="mx-auto grid w-full max-w-5xl grid-cols-5 gap-2 px-2 py-2">
        {items.map((item) => {
          const { href, path, label, icon: Icon, badge } = item;
          const active =
            activePath === href ||
            activePath.startsWith(`${href}/`) ||
            (path ? activePath === path || activePath.startsWith(`${path}/`) : false);
          return (
          <Link
            key={href}
            href={withAlunoParam(href)}
            prefetch
            onPointerEnter={() => handlePreload(item)}
            onTouchStart={() => handlePreload(item)}
            className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-black transition-all duration-300 active:scale-90 ${
              active
                ? "text-klasse-green scale-110"
                : "text-slate-400 hover:text-slate-600"
            }`}
              aria-current={active ? "page" : undefined}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                  active ? "bg-klasse-green-50 shadow-sm" : "bg-transparent"
              }`}>
                <Icon className={`h-5 w-5 transition-all ${active ? "fill-current" : ""}`} />
              </div>
              <span className={`transition-opacity duration-300 ${active ? "opacity-100" : "opacity-70"}`}>
                {label}
              </span>
              {badge && badge > 0 && (
                <span className="absolute right-3 top-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-sm ring-2 border-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
