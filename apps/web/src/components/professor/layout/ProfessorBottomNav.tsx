import Link from "next/link";
import type { ProfessorNavItem } from "@/lib/professorNav";

type Props = {
  items: ProfessorNavItem[];
  activePath: string;
};

export function ProfessorBottomNav({ items, activePath }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação do portal do professor"
    >
      <div className="mx-auto grid w-full max-w-5xl grid-cols-5 gap-2 px-2 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = activePath === href || activePath.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition ${
                active
                  ? "bg-klasse-green-50 text-klasse-green-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
