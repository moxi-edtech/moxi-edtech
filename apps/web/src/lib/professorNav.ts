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
  { path: "/professor/materiais", label: "Materiais", icon: BookOpenIcon },
  { path: "/professor/calendario", label: "Calendário", icon: CalendarDays },
  { path: "/professor/perfil", label: "Perfil", icon: User },
];
