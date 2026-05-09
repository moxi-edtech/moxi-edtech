import {
  LayoutDashboard,
  ClipboardCheck,
  FileText,
  Workflow,
  User,
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
  { path: "/professor/fluxos", label: "Fluxos", icon: Workflow },
  { path: "/professor/perfil", label: "Perfil", icon: User },
];
