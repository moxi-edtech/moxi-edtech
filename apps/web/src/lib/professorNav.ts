import {
  CalendarDays,
  LayoutDashboard,
  ClipboardCheck,
  FileText,
  User,
  BookOpen as BookOpenIcon,
  type LucideIcon,
} from "lucide-react";

export type ProfessorNavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
};

export type ProfessorNavLink = ProfessorNavItem & {
  href: string;
};

export const professorNavItems: ProfessorNavItem[] = [
  { path: "/professor", label: "Início", icon: LayoutDashboard },
  { path: "/professor/frequencias", label: "Frequências", icon: ClipboardCheck },
  { path: "/professor/notas", label: "Notas", icon: FileText },
  { path: "/professor/provas", label: "Provas", icon: ClipboardCheck },
  { path: "/professor/materiais", label: "Materiais", icon: BookOpenIcon },
  { path: "/professor/calendario", label: "Calendário", icon: CalendarDays },
  { path: "/professor/perfil", label: "Perfil", icon: User },
];

/**
 * Devolve uma única navegação activa. "/professor" é prefixo de todas
 * as páginas; é indispensável escolher a rota mais específica.
 */
export function getActiveProfessorNavHref(items: ProfessorNavLink[], activePath: string): string | null {
  const matches = items.filter(({ href, path }) =>
    activePath === href ||
    activePath.startsWith(`${href}/`) ||
    activePath === path ||
    activePath.startsWith(`${path}/`),
  );
  return matches.sort((a, b) => b.path.length - a.path.length)[0]?.href ?? null;
}
