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
    { href: "/super-admin", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/super-admin/health", label: "Saúde", icon: "HeartPulse" },
    { href: "/super-admin/diagnostics", label: "Diagnostics", icon: "Activity" },
    { href: "/super-admin/escolas", label: "Escolas", icon: "Building2" },
    { href: "/super-admin/usuarios", label: "Usuários", icon: "Users" },
    { href: "/super-admin/planos", label: "Planos", icon: "TrendingUp" },
    { href: "/super-admin/logs", label: "Logs", icon: "Files" },
    { href: "/super-admin/configuracoes", label: "Configurações", icon: "Settings" },
  ],
  admin: [
    { href: "/escola/[escolaId]/admin/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/escola/[escolaId]/admin/alunos", label: "Alunos", icon: "Users" },
    { href: "/escola/[escolaId]/admin/professores", label: "Professores", icon: "User" },
    { href: "/escola/[escolaId]/admin/turmas", label: "Turmas", icon: "GraduationCap" },
    { href: "/escola/[escolaId]/admin/avisos", label: "Avisos", icon: "Megaphone" },
    { href: "/escola/[escolaId]/admin/configuracoes", label: "Configurações", icon: "Settings" },
  ],
  secretaria: [
    { href: "/escola/[escolaId]/secretaria", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/escola/[escolaId]/secretaria/alunos", label: "Alunos", icon: "Users" },
    { href: "/escola/[escolaId]/secretaria/admissoes", label: "Admissões", icon: "GraduationCap" },
    { href: "/financeiro/fecho", label: "Meu Caixa", icon: "Wallet" },
    { href: "/escola/[escolaId]/secretaria/acesso", label: "Acesso ao Portal", icon: "KeyRound" },
    { href: "/escola/[escolaId]/secretaria/turmas", label: "Turmas", icon: "BookOpen" },
    { href: "/escola/[escolaId]/secretaria/calendario", label: "Calendário", icon: "CalendarDays" },
    { href: "/escola/[escolaId]/secretaria/relatorios", label: "Relatórios", icon: "BarChart" },
    { href: "/escola/[escolaId]/secretaria/importacoes", label: "Histórico de Importações", icon: "History" },
  ],
  financeiro: [
    { href: "/financeiro", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/financeiro/turmas-alunos", label: "Turmas & Alunos", icon: "UsersRound" },
    { href: "/financeiro/radar", label: "Radar", icon: "Radar", badge: "Novo" },
    { href: "/financeiro/candidaturas", label: "Candidaturas", icon: "FileText" },
    { href: "/financeiro/configuracoes/precos", label: "Tabelas de Preço", icon: "Table" },
    { href: "/financeiro/tabelas-mensalidade", label: "Tabelas de Mensalidade", icon: "Table" },
    { href: "/financeiro/conciliacao", label: "Conciliação Bancária", icon: "ArrowsRightLeft" },
    { href: "/financeiro/conciliacao", label: "Conciliação", icon: "Scale" },
    { href: "/financeiro/cobrancas", label: "Cobranças", icon: "BadgeDollarSign" },
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
