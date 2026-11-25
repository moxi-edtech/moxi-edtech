import Link from "next/link";
import { getActiveProfessorNavHref, type ProfessorNavLink } from "@/lib/professorNav";

type Props = {
  items: ProfessorNavLink[];
  activePath: string;
};

const compactLabels: Record<string, string> = {
  "/professor/frequencias": "Chamada",
  "/professor/materiais": "Material",
  "/professor/calendario": "Agenda",
};

export function ProfessorBottomNav({ items, activePath }: Props) {
  // A rota /professor é prefixo de todas as outras; só a correspondência
  // mais específica pode estar activa (nunca Início + Calendário).
  const activeHref = getActiveProfessorNavHref(items, activePath);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação do portal do professor"
    >
      <div className="mx-auto grid w-full max-w-5xl grid-flow-col auto-cols-[minmax(44px,1fr)] overflow-x-auto gap-0.5 px-1 py-1.5 sm:gap-1 sm:py-2">
        {items.map(({ href, path, label, icon: Icon }) => {
          const active = activeHref === href;
          return (
            <Link
              key={href}
              href={href}
              prefetch={path !== "/professor/provas"}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[9px] font-semibold transition-colors min-[390px]:text-[10px] ${active
                ? "bg-klasse-gold-50 text-klasse-gold-700 ring-1 ring-klasse-gold/30"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="max-w-full truncate text-center">{compactLabels[path] ?? label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
