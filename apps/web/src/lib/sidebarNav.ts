// apps/web/src/lib/sidebarNav.ts
import { type UserRole } from "@/hooks/useUserRole";
import * as Icons from "lucide-react";

export type IconName = keyof typeof Icons;

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
};

type SidebarConfig = {
  [key in UserRole]?: NavItem[];
};

export const sidebarConfig: SidebarConfig = {
  superadmin: [
    { href: "/super-admin/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/super-admin/escolas", label: "Escolas", icon: "Building2" },
    { href: "/super-admin/usuarios", label: "Usuários", icon: "Users" },
    { href: "/super-admin/planos", label: "Planos", icon: "TrendingUp" },
    { href: "/super-admin/logs", label: "Logs", icon: "Files" },
    { href: "/super-admin/configuracoes", label: "Configurações", icon: "Settings" },
  ],
  admin: [
    { href: "/escola/bb4b4278-3403-4f2f-8a73-dd4917fd1fde/admin/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/escola/[escolaId]/admin/alunos", label: "Alunos", icon: "Users" },
    { href: "/escola/[escolaId]/admin/professores", label: "Professores", icon: "User" },
    { href: "/escola/[escolaId]/admin/turmas", label: "Turmas", icon: "GraduationCap" },
    { href: "/escola/[escolaId]/admin/avisos", label: "Avisos", icon: "Megaphone" },
    { href: "/escola/[escolaId]/admin/configuracoes", label: "Configurações", icon: "Settings" },
  ],
  secretaria: [
    { href: "/secretaria/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/secretaria/alunos", label: "Alunos", icon: "Users" },
    { href: "/secretaria/matriculas", label: "Matrículas", icon: "GraduationCap" },
    { href: "/secretaria/turmas", label: "Turmas", icon: "BookOpen" },
    { href: "/secretaria/calendario", label: "Calendário", icon: "CalendarDays" },
    { href: "/secretaria/relatorios", label: "Relatórios", icon: "BarChart" },
  ],
  financeiro: [
    { href: "/financeiro", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/financeiro/mensalidades", label: "Mensalidades", icon: "Wallet" },
    { href: "/financeiro/configuracoes/precos", label: "Tabelas de Preço", icon: "Table" },
    { href: "/financeiro/faturas", label: "Faturas", icon: "FileText" },
    { href: "/financeiro/cobrancas", label: "Cobranças", icon: "BadgeDollarSign" },
    { href: "/financeiro/plano-contas", label: "Plano de Contas", icon: "Scale" },
    { href: "/financeiro/relatorios", label: "Relatórios", icon: "BarChart" },
  ],
  aluno: [
    { href: "/aluno/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/aluno/minhas-turmas", label: "Minhas Turmas", icon: "BookOpen" },
    { href: "/aluno/notas", label: "Minhas Notas", icon: "FileText" },
    { href: "/aluno/financeiro", label: "Financeiro", icon: "Wallet" },
  ],
  professor: [
    { href: "/professor/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/professor/minhas-turmas", label: "Minhas Turmas", icon: "BookOpen" },
    { href: "/professor/lancar-notas", label: "Lançar Notas", icon: "FileText" },
    { href: "/professor/minhas-disciplinas", label: "Minhas Disciplinas", icon: "BookOpen" },
  ],
  gestor: [
    { href: "/gestor/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/gestor/escolas", label: "Gerenciar Escolas", icon: "Building2" },
    { href: "/gestor/usuarios", label: "Gerenciar Usuários", icon: "Users" },
  ],
};
