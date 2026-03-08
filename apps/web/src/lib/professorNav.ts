import {
  LayoutDashboard,
  ClipboardCheck,
  FileText,
  Workflow,
  User,
  type LucideIcon,
} from "lucide-react";

export type ProfessorNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const professorNavItems: ProfessorNavItem[] = [
  { href: "/professor", label: "Início", icon: LayoutDashboard },
  { href: "/professor/frequencias", label: "Frequências", icon: ClipboardCheck },
  { href: "/professor/notas", label: "Notas", icon: FileText },
  { href: "/professor/fluxos", label: "Fluxos", icon: Workflow },
  { href: "/professor/perfil", label: "Perfil", icon: User },
];
