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

export type SidebarRole = UserRole | "operacoes";

type SidebarConfig = {
  [key in SidebarRole]?: NavItem[];
};

export const sidebarConfig: SidebarConfig = {
  superadmin: [
    { href: "/super-admin", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/super-admin/health", label: "Saúde", icon: "HeartPulse" },
    { href: "/super-admin/diagnostics", label: "Diagnostics", icon: "Activity" },
    { href: "/super-admin/escolas", label: "Escolas", icon: "Building2" },
    { href: "/super-admin/centros-formacao", label: "Centros Formação", icon: "GraduationCap" },
    { href: "/super-admin/onboarding", label: "Onboarding", icon: "UserPlus", badge: "Novo" },
    { href: "/super-admin/parceiros", label: "Parceiros", icon: "UsersRound" },
    { href: "/super-admin/marketing", label: "Marketing", icon: "Megaphone" },
    { href: "/super-admin/planos", label: "Planos e Preços", icon: "Settings2" },
    { href: "/super-admin/cobrancas", label: "Cobranças", icon: "BadgeDollarSign" },
    { href: "/super-admin/subscricoes", label: "Subscrições", icon: "CreditCard", badge: "Novo" },
    { href: "/super-admin/usuarios", label: "Usuários", icon: "Users" },
    { href: "/super-admin/comunicacao", label: "Comunicação", icon: "Mail", badge: "Novo" },
  ],
  operacoes: [
    { href: "/escola/[escolaId]/operacoes/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/escola/[escolaId]/operacoes/alunos", label: "Alunos", icon: "Users" },
    {
      href: "/escola/[escolaId]/operacoes/matriculas",
      label: "Matrículas & Admissões",
      icon: "UserPlus",
      children: [
        { href: "/escola/[escolaId]/operacoes/admissoes", label: "Todas as admissões" },
        { href: "/escola/[escolaId]/operacoes/admissoes/nova", label: "Nova admissão" },
        { href: "/escola/[escolaId]/operacoes/matriculas", label: "Matrículas" },
        { href: "/escola/[escolaId]/operacoes/matriculas/nova", label: "Nova matrícula" },
        { href: "/escola/[escolaId]/operacoes/rematricula", label: "Rematrículas" },
        { href: "/escola/[escolaId]/operacoes/rematricula/janelas", label: "Janelas de rematrícula" },
      ],
    },
    { href: "/escola/[escolaId]/operacoes/professores", label: "Professores", icon: "User" },
    {
      href: "/escola/[escolaId]/operacoes/turmas",
      label: "Turmas & Classes",
      icon: "GraduationCap",
      children: [
        { href: "/escola/[escolaId]/operacoes/turmas", label: "Lista de turmas" },
        { href: "/escola/[escolaId]/operacoes/turmas?status=pendente", label: "Pendentes" },
        { href: "/escola/[escolaId]/operacoes/turmas/ocupacao", label: "Ocupação" },
        { href: "/escola/[escolaId]/operacoes/classes", label: "Classes" },
      ],
    },
    {
      href: "/escola/[escolaId]/operacoes/academico",
      label: "Operações Académicas",
      icon: "Activity",
      children: [
        { href: "/escola/[escolaId]/operacoes/academico", label: "Visão geral" },
        { href: "/escola/[escolaId]/operacoes/academico/fechamento-academico", label: "Fechamento Trimestral" },
        { href: "/escola/[escolaId]/operacoes/academico/fechamento-academico/cockpit", label: "Cockpit de Prontidão" },
        { href: "/escola/[escolaId]/operacoes/academico/sanidade", label: "Sanidade Académica" },
      ],
    },
    {
      href: "/escola/[escolaId]/operacoes/calendario",
      label: "Horários & Calendário",
      icon: "CalendarDays",
      children: [
        { href: "/escola/[escolaId]/operacoes/horarios/quadro", label: "Quadro de horários" },
        { href: "/escola/[escolaId]/operacoes/horarios/slots", label: "Tempos e turnos" },
        { href: "/escola/[escolaId]/operacoes/calendario", label: "Calendário escolar" },
      ],
    },
    {
      href: "/escola/[escolaId]/operacoes/documentos",
      label: "Documentos",
      icon: "FileText",
      children: [
        { href: "/escola/[escolaId]/operacoes/documentos", label: "Emissão de Declarações" },
        { href: "/escola/[escolaId]/operacoes/documentos-oficiais", label: "Documentos Oficiais (MED)" },
      ],
    },
    {
      href: "/escola/[escolaId]/operacoes/recebimentos",
      label: "Recebimentos",
      icon: "Wallet",
      children: [
        { href: "/escola/[escolaId]/operacoes/recebimentos", label: "Balcão & cobrança" },
        { href: "/escola/[escolaId]/operacoes/turmas-alunos", label: "Carteira por turma/aluno" },
        { href: "/escola/[escolaId]/operacoes/fecho", label: "Fecho de caixa" },
      ],
    },
    {
      href: "/escola/[escolaId]/operacoes/acessos",
      label: "Acessos ao Portal",
      icon: "KeyRound",
      children: [
        { href: "/escola/[escolaId]/operacoes/acessos", label: "Gestão de acessos" },
        { href: "/escola/[escolaId]/operacoes/acesso-alunos", label: "Acesso dos alunos" },
      ],
    },
    {
      href: "/escola/[escolaId]/operacoes/relatorios",
      label: "Relatórios",
      icon: "BarChart3",
      children: [
        { href: "/escola/[escolaId]/operacoes/relatorios", label: "Auditoria" },
        { href: "/escola/[escolaId]/operacoes/relatorios/mapa-aproveitamento", label: "Mapa de Aproveitamento" },
        { href: "/escola/[escolaId]/operacoes/relatorios/mensal-escolar", label: "Mensal Escolar" },
        { href: "/escola/[escolaId]/operacoes/relatorios/propinas", label: "Propinas" },
      ],
    },
    {
      href: "/escola/[escolaId]/operacoes/avisos",
      label: "Avisos",
      icon: "Megaphone",
      children: [
        { href: "/escola/[escolaId]/operacoes/avisos", label: "Fila de avisos" },
        { href: "/escola/[escolaId]/operacoes/alertas", label: "Alertas operacionais" },
        { href: "/escola/[escolaId]/operacoes/avisos/novo", label: "Novo aviso" },
      ],
    },
    {
      href: "/escola/[escolaId]/operacoes/comunicacao/whatsapp",
      label: "WhatsApp KLASSE",
      icon: "MessageSquare",
      children: [
        { href: "/escola/[escolaId]/operacoes/comunicacao/whatsapp", label: "Central WhatsApp" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/comunicacao", label: "Configurar sessão" },
      ],
    },
    {
      href: "/escola/[escolaId]/operacoes/importacoes",
      label: "Integração de Dados",
      icon: "History",
      children: [
        { href: "/escola/[escolaId]/operacoes/importacoes", label: "Histórico de importações" },
        { href: "/escola/[escolaId]/operacoes/migracao/alunos", label: "Migrar alunos" },
        { href: "/escola/[escolaId]/operacoes/migracao/historico", label: "Histórico transitado" },
        { href: "/escola/[escolaId]/operacoes/migracao/pautas", label: "Migrar pautas" },
        { href: "/escola/[escolaId]/operacoes/exportacoes", label: "Exportações" },
      ],
    },
    {
      href: "/escola/[escolaId]/operacoes/configuracoes",
      label: "Configurações",
      icon: "Settings2",
      children: [
        { href: "/escola/[escolaId]/operacoes/configuracoes", label: "Visão geral" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/estrutura", label: "Oferta formativa" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/identidade", label: "Identidade" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/calendario", label: "Calendário escolar" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/avaliacao", label: "Sistema de avaliação" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/turmas", label: "Turmas" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/financeiro", label: "Políticas financeiras" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/mensalidades", label: "Mensalidades & emolumentos" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/comunicacao", label: "Comunicação" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/fluxos", label: "Fluxos" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/excecoes", label: "Exceções" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/sistema", label: "Sistema" },
        { href: "/escola/[escolaId]/operacoes/configuracoes/avancado", label: "Avançado" },
      ],
    },
  ],
  admin: [
    { href: "/escola/[escolaId]/admin/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/escola/[escolaId]/admin/alunos", label: "Alunos", icon: "Users" },
    {
      href: "/escola/[escolaId]/secretaria/admissoes",
      label: "Matrículas",
      icon: "UserPlus",
      children: [
        { href: "/escola/[escolaId]/secretaria/admissoes", label: "Todas" },
        { href: "/escola/[escolaId]/secretaria/admissoes/nova", label: "Nova matrícula" },
      ],
    },
    { href: "/escola/[escolaId]/admin/professores", label: "Professores", icon: "User" },
    { href: "/escola/[escolaId]/admin/operacoes-academicas", label: "Operações Académicas", icon: "Activity" },
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
    { href: "/escola/[escolaId]/admin/comunicacao/whatsapp", label: "WhatsApp KLASSE", icon: "MessageSquare" },
    { href: "/escola/[escolaId]/admin/ai/actions", label: "Central IA", icon: "ClipboardList" },
    { href: "/escola/[escolaId]/horarios/quadro", label: "Horários", icon: "CalendarClock" },
    {
      href: "/escola/[escolaId]/admin/relatorios",
      label: "Relatórios",
      icon: "BarChart",
      children: [
        { href: "/escola/[escolaId]/admin/relatorios", label: "Visão geral" },
        { href: "/escola/[escolaId]/financeiro/relatorios/mensal-escolar", label: "Mensal Escolar" },
      ],
    },
    { href: "/escola/[escolaId]/admin/documentos-oficiais", label: "Documentos Oficiais", icon: "FileText" },
    {
      href: "/escola/[escolaId]/admin/configuracoes",
      label: "Configurações",
      icon: "Settings2",
      children: [
        { href: "/escola/[escolaId]/admin/configuracoes", label: "Visão geral" },
        { href: "/escola/[escolaId]/admin/configuracoes/calendario", label: "Calendário" },
        { href: "/escola/[escolaId]/admin/configuracoes/avaliacao", label: "Avaliações" },
        { href: "/escola/[escolaId]/admin/configuracoes/turmas", label: "Turmas" },
        { href: "/escola/[escolaId]/horarios/quadro", label: "Horários" },
        { href: "/escola/[escolaId]/admin/configuracoes/financeiro", label: "Financeiro · Políticas" },
        { href: "/escola/[escolaId]/admin/configuracoes/mensalidades", label: "Mensalidades & Emolumentos" },
        { href: "/escola/[escolaId]/admin/configuracoes/fluxos", label: "Fluxos" },
        { href: "/escola/[escolaId]/admin/configuracoes/excecoes", label: "Exceções" },
        { href: "/escola/[escolaId]/admin/configuracoes/avancado", label: "Avançado" },
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
        { href: "/escola/[escolaId]/secretaria/rematricula/janelas", label: "Janelas de rematrícula" },
      ],
    },
    { href: "/escola/[escolaId]/secretaria/fecho", label: "Fecho de Caixa", icon: "Lock" },
    { href: "/escola/[escolaId]/secretaria/recebimentos", label: "Recebimentos", icon: "Wallet" },
    { href: "/escola/[escolaId]/secretaria/acesso", label: "Acesso ao Portal", icon: "KeyRound" },
    { href: "/escola/[escolaId]/admin/comunicacao/whatsapp", label: "WhatsApp KLASSE", icon: "MessageSquare" },
    {
      href: "/escola/[escolaId]/secretaria/turmas",
      label: "Turmas",
      icon: "BookOpen",
      children: [
        { href: "/escola/[escolaId]/secretaria/turmas", label: "Lista de turmas" },
        { href: "/escola/[escolaId]/secretaria/classes", label: "Classes" },
      ],
    },
    {
      href: "/escola/[escolaId]/horarios/quadro",
      label: "Horários",
      icon: "CalendarClock",
      children: [
        { href: "/escola/[escolaId]/horarios/quadro", label: "Quadro de horários" },
        { href: "/escola/[escolaId]/horarios/slots", label: "Tempos e turnos" },
      ],
    },
    { href: "/escola/[escolaId]/secretaria/calendario", label: "Calendário", icon: "CalendarDays" },
    { href: "/escola/[escolaId]/secretaria/exportacoes", label: "Exportações", icon: "Archive" },
    { href: "/escola/[escolaId]/secretaria/documentos-oficiais", label: "Documentos Oficiais", icon: "FileText" },
    { href: "/escola/[escolaId]/secretaria/operacoes-academicas", label: "Operações Acadêmicas", icon: "Activity" },
    { href: "/escola/[escolaId]/secretaria/importacoes", label: "Histórico de Importações", icon: "History" },
    {
      href: "/escola/[escolaId]/secretaria/relatorios",
      label: "Relatórios",
      icon: "BarChart3",
      children: [
        { href: "/escola/[escolaId]/secretaria/relatorios", label: "Auditoria" },
        { href: "/escola/[escolaId]/secretaria/relatorios/mensal-escolar", label: "Mensal Escolar" },
        { href: "/escola/[escolaId]/secretaria/relatorios/propinas", label: "Propinas" },
        { href: "/escola/[escolaId]/secretaria/relatorios/mapa-aproveitamento", label: "Mapa de Aproveitamento" },
      ],
    },
  ],
  financeiro: [
    { href: "/escola/[escolaId]/financeiro", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/escola/[escolaId]/financeiro/turmas-alunos", label: "Turmas & Alunos", icon: "UsersRound" },
    {
      href: "/escola/[escolaId]/financeiro/pagamentos",
      label: "Pagamentos",
      icon: "Wallet",
      children: [
        { href: "/escola/[escolaId]/financeiro/pagamentos", label: "Lista" },
        { href: "/escola/[escolaId]/financeiro/radar", label: "Cobranças" },
        { href: "/escola/[escolaId]/financeiro/fecho", label: "Fecho de Caixa" },
        { href: "/escola/[escolaId]/financeiro/conciliacao", label: "Conciliação" },
      ],
    },
    { href: "/escola/[escolaId]/financeiro/candidaturas", label: "Candidaturas", icon: "FileText" },
    { href: "/escola/[escolaId]/admin/comunicacao/whatsapp", label: "WhatsApp KLASSE", icon: "MessageSquare" },
    {
      href: "/escola/[escolaId]/financeiro/tabelas-mensalidade",
      label: "Tabelas",
      icon: "Layers",
      children: [
        { href: "/escola/[escolaId]/financeiro/configuracoes/precos", label: "Tabelas de Preço" },
        { href: "/escola/[escolaId]/financeiro/tabelas-mensalidade", label: "Mensalidades" },
      ],
    },
    {
      href: "/escola/[escolaId]/financeiro/relatorios",
      label: "Relatórios",
      icon: "BarChart",
      children: [
        { href: "/escola/[escolaId]/financeiro/relatorios", label: "Visão geral" },
        { href: "/escola/[escolaId]/financeiro/relatorios/mensal-escolar", label: "Mensal Escolar" },
        { href: "/escola/[escolaId]/financeiro/relatorios/propinas", label: "Propinas" },
        { href: "/escola/[escolaId]/financeiro/relatorios/fluxo-caixa", label: "Fluxo de Caixa" },
        { href: "/escola/[escolaId]/financeiro/relatorios/pagamentos-status", label: "Pagamentos Status" },
        { href: "/escola/[escolaId]/financeiro/relatorios/detalhados", label: "Detalhados" },
      ],
    },
    { href: "/escola/[escolaId]/financeiro/fiscal", label: "Fiscal & Compliance", icon: "BadgeDollarSign" },
  ],
  aluno: [
    { href: "/escola/[escolaId]/aluno/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/escola/[escolaId]/aluno/academico", label: "Académico", icon: "BookOpen" },
    { href: "/escola/[escolaId]/aluno/documentos", label: "Documentos", icon: "FileText" },
    { href: "/escola/[escolaId]/aluno/financeiro", label: "Financeiro", icon: "Wallet" },
  ],
  professor: [
    { href: "/escola/[escolaId]/professor", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/escola/[escolaId]/professor/frequencias", label: "Frequências", icon: "BookOpen" },
    { href: "/escola/[escolaId]/professor/notas", label: "Lançar Notas", icon: "FileText" },
    { href: "/escola/[escolaId]/professor/calendario", label: "Calendário", icon: "CalendarDays" },
    { href: "/escola/[escolaId]/professor/perfil", label: "Perfil", icon: "User" },
  ],
  gestor: [
    { href: "/gestor/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/gestor/escolas", label: "Gerenciar Escolas", icon: "Building2" },
    { href: "/gestor/usuarios", label: "Gerenciar Usuários", icon: "Users" },
  ],
};
