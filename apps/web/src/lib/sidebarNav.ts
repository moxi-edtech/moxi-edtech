// apps/web/src/lib/sidebarNav.ts
import { type UserRole } from "@/hooks/useUserRole";

export type IconName = string;

export type SubNavItem = {
  href: string;
  label: string;
  badge?: string;
};

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
  children?: SubNavItem[];
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
    { href: "/super-admin/cobrancas", label: "Cobranças", icon: "BadgeDollarSign" },
    { href: "/super-admin/usuarios", label: "Usuários", icon: "Users" },
  ],
  admin: [
    { href: "/escola/[escolaId]/admin/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/escola/[escolaId]/admin/alunos", label: "Alunos", icon: "Users" },
    { href: "/escola/[escolaId]/admin/professores", label: "Professores", icon: "User" },
    {
      href: "/escola/[escolaId]/admin/turmas",
      label: "Turmas",
      icon: "GraduationCap",
      children: [
        { href: "/escola/[escolaId]/admin/turmas", label: "Lista de turmas" },
        { href: "/escola/[escolaId]/admin/turmas?status=pendente", label: "Pendentes" },
      ],
    },
    { href: "/escola/[escolaId]/admin/avisos", label: "Avisos", icon: "Megaphone" },
    { href: "/escola/[escolaId]/horarios/quadro", label: "Horários", icon: "CalendarClock" },
    {
      href: "/escola/[escolaId]/admin/relatorios",
      label: "Relatórios",
      icon: "BarChart",
      children: [
        { href: "/escola/[escolaId]/admin/relatorios", label: "Visão geral" },
      ],
    },
    { href: "/escola/[escolaId]/admin/documentos-oficiais", label: "Documentos Oficiais", icon: "FileText" },
    {
      href: "/escola/[escolaId]/admin/configuracoes",
      label: "Configurações",
      icon: "Settings2",
      children: [
        { href: "/escola/[escolaId]/admin/configuracoes", label: "Visão geral" },
        { href: "/escola/[escolaId]/admin/configuracoes/assinatura", label: "Assinatura Klasse" },
        { href: "/escola/[escolaId]/admin/configuracoes/financeiro", label: "Financeiro" },
        { href: "/escola/[escolaId]/admin/configuracoes/calendario", label: "Calendário" },
        { href: "/escola/[escolaId]/admin/configuracoes/seguranca", label: "Segurança" },
        { href: "/escola/[escolaId]/admin/configuracoes/identidade", label: "Identidade" },
      ],
    },
  ],
  secretaria: [
    { href: "/escola/[escolaId]/secretaria", label: "Dashboard", icon: "LayoutDashboard" },
    {
      href: "/escola/[escolaId]/secretaria/admissoes",
      label: "Admissões",
      icon: "GraduationCap",
      children: [
        { href: "/escola/[escolaId]/secretaria/admissoes", label: "Todas" },
        { href: "/escola/[escolaId]/secretaria/admissoes/nova", label: "Nova admissão" },
      ],
    },
    {
      href: "/escola/[escolaId]/secretaria/alunos",
      label: "Alunos",
      icon: "Users",
      children: [
        { href: "/escola/[escolaId]/secretaria/alunos", label: "Lista de alunos" },
        { href: "/escola/[escolaId]/secretaria/matriculas", label: "Matrículas" },
        { href: "/escola/[escolaId]/secretaria/rematricula", label: "Rematrícula" },
      ],
    },
    { href: "/escola/[escolaId]/secretaria/fecho", label: "Fecho de Caixa", icon: "Lock" },
    { href: "/escola/[escolaId]/secretaria/acesso", label: "Acesso ao Portal", icon: "KeyRound" },
    {
      href: "/escola/[escolaId]/secretaria/turmas",
      label: "Turmas",
      icon: "BookOpen",
      children: [
        { href: "/escola/[escolaId]/secretaria/turmas", label: "Lista de turmas" },
        { href: "/escola/[escolaId]/secretaria/classes", label: "Classes" },
      ],
    },
    { href: "/escola/[escolaId]/secretaria/calendario", label: "Calendário", icon: "CalendarDays" },
    { href: "/escola/[escolaId]/secretaria/exportacoes", label: "Exportações", icon: "Archive" },
    { href: "/escola/[escolaId]/secretaria/documentos-oficiais", label: "Documentos Oficiais", icon: "FileText" },
    { href: "/escola/[escolaId]/secretaria/importacoes", label: "Histórico de Importações", icon: "History" },
  ],
  financeiro: [
    { href: "/financeiro", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/financeiro/turmas-alunos", label: "Turmas & Alunos", icon: "UsersRound" },
    {
      href: "/financeiro/pagamentos",
      label: "Pagamentos",
      icon: "Wallet",
      children: [
        { href: "/financeiro/pagamentos", label: "Lista" },
        { href: "/financeiro/radar", label: "Radar" },
        { href: "/financeiro/fecho", label: "Fecho de Caixa" },
        { href: "/financeiro/conciliacao", label: "Conciliação" },
      ],
    },
    { href: "/financeiro/candidaturas", label: "Candidaturas", icon: "FileText" },
    {
      href: "/financeiro/tabelas-mensalidade",
      label: "Tabelas",
      icon: "Layers",
      children: [
        { href: "/financeiro/configuracoes/precos", label: "Tabelas de Preço" },
        { href: "/financeiro/tabelas-mensalidade", label: "Mensalidades" },
      ],
    },
    { href: "/financeiro/cobrancas", label: "Cobranças", icon: "BadgeDollarSign" },
    {
      href: "/financeiro/relatorios",
      label: "Relatórios",
      icon: "BarChart",
      children: [
        { href: "/financeiro/relatorios", label: "Visão geral" },
        { href: "/financeiro/relatorios/propinas", label: "Propinas" },
        { href: "/financeiro/relatorios/fluxo-caixa", label: "Fluxo de Caixa" },
        { href: "/financeiro/relatorios/pagamentos-status", label: "Pagamentos Status" },
        { href: "/financeiro/relatorios/detalhados", label: "Detalhados" },
      ],
    },
  ],
  aluno: [
    { href: "/aluno/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/aluno/minhas-turmas", label: "Minhas Turmas", icon: "BookOpen" },
    { href: "/aluno/notas", label: "Minhas Notas", icon: "FileText" },
    { href: "/aluno/financeiro", label: "Financeiro", icon: "Wallet" },
  ],
  professor: [
    { href: "/professor", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/professor/frequencias", label: "Frequências", icon: "BookOpen" },
    { href: "/professor/notas", label: "Lançar Notas", icon: "FileText" },
    { href: "/professor/fluxos", label: "Fluxos", icon: "BookOpen" },
    { href: "/professor/perfil", label: "Perfil", icon: "User" },
  ],
  gestor: [
    { href: "/gestor/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/gestor/escolas", label: "Gerenciar Escolas", icon: "Building2" },
    { href: "/gestor/usuarios", label: "Gerenciar Usuários", icon: "Users" },
  ],
};
