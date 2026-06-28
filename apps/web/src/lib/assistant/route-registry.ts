export type KlasseRoute = {
  key: string;
  title: string;
  module:
    | "dashboard"
    | "secretaria"
    | "financeiro"
    | "academico"
    | "comunicacao"
    | "whatsapp"
    | "classe_ai"
    | "operacoes";
  description: string;
  roles: string[];
  aliases: string[];
  href: (schoolId: string, params?: Record<string, string>) => string;
};

export const KLASSE_ROUTES: KlasseRoute[] = [
  {
    key: "dashboard_geral",
    title: "Dashboard Geral",
    module: "dashboard",
    description: "Painel inicial com indicadores gerais e operacionais rápidos da escola.",
    roles: ["admin", "admin_escola", "staff_admin", "direcao", "diretoria"],
    aliases: ["dashboard", "painel", "resumo", "inicio", "página inicial", "indicadores"],
    href: (schoolId) => `/escola/${schoolId}/admin`,
  },
  {
    key: "alunos_lista",
    title: "Lista de Alunos",
    module: "secretaria",
    description: "Visualizar, pesquisar e gerenciar a lista de alunos matriculados.",
    roles: [
      "admin",
      "admin_escola",
      "staff_admin",
      "secretaria",
      "financeiro",
      "admin_financeiro",
      "secretaria_financeiro",
      "direcao",
      "diretoria",
    ],
    aliases: ["alunos", "lista de alunos", "pesquisar aluno", "procurar aluno", "buscar aluno", "estudantes"],
    href: (schoolId) => `/escola/${schoolId}/secretaria/alunos`,
  },
  {
    key: "aluno_novo",
    title: "Novo Aluno",
    module: "secretaria",
    description: "Cadastrar um novo aluno no sistema.",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    aliases: ["novo aluno", "cadastrar aluno", "adicionar aluno", "matricular aluno", "criar aluno"],
    href: (schoolId) => `/escola/${schoolId}/secretaria/alunos/novo`,
  },
  {
    key: "aluno_ficha",
    title: "Ficha do Aluno",
    module: "secretaria",
    description: "Detalhes e histórico completo do aluno.",
    roles: [
      "admin",
      "admin_escola",
      "staff_admin",
      "secretaria",
      "financeiro",
      "admin_financeiro",
      "secretaria_financeiro",
      "direcao",
      "diretoria",
    ],
    aliases: ["ficha do aluno", "perfil do aluno", "dados do aluno", "dossiê do aluno", "detalhes do aluno"],
    href: (schoolId, params) => `/escola/${schoolId}/secretaria/alunos/${params?.alunoId || ""}`,
  },
  {
    key: "turmas",
    title: "Turmas",
    module: "secretaria",
    description: "Gerenciar salas, turmas e enturmações de alunos.",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    aliases: ["turmas", "ver turmas", "salas", "classes", "criar turma"],
    href: (schoolId) => `/escola/${schoolId}/secretaria/turmas`,
  },
  {
    key: "notas",
    title: "Notas",
    module: "academico",
    description: "Lançamento de notas, pautas escolares e avaliações dos alunos.",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    aliases: ["notas", "lançar notas", "pautas", "avaliações", "boletim", "boletins"],
    href: (schoolId) => `/escola/${schoolId}/admin/notas`,
  },
  {
    key: "presencas",
    title: "Presenças / Frequência",
    module: "academico",
    description: "Registro de presenças e controle de faltas dos alunos.",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    aliases: ["presenças", "frequência", "faltas", "registrar faltas", "calendário", "chamada"],
    href: (schoolId) => `/escola/${schoolId}/secretaria/calendario`,
  },
  {
    key: "radar_financeiro",
    title: "Radar Financeiro",
    module: "financeiro",
    description: "Radar de inadimplência e identificação de propinas/mensalidades em atraso.",
    roles: [
      "admin",
      "admin_escola",
      "staff_admin",
      "financeiro",
      "admin_financeiro",
      "secretaria_financeiro",
      "direcao",
      "diretoria",
    ],
    aliases: ["radar", "inadimplentes", "radar financeiro", "atrasos", "devedores", "cobrança", "propinas atrasadas"],
    href: (schoolId) => `/escola/${schoolId}/financeiro/radar`,
  },
  {
    key: "pagamentos",
    title: "Pagamentos",
    module: "financeiro",
    description: "Lançamento de pagamentos, mensalidades e emissão de recibos.",
    roles: ["admin", "admin_escola", "staff_admin", "financeiro", "admin_financeiro", "secretaria_financeiro"],
    aliases: ["pagamentos", "lançar pagamento", "receber propina", "recibos", "mensalidades", "caixa"],
    href: (schoolId) => `/escola/${schoolId}/financeiro/pagamentos`,
  },
  {
    key: "comunicados",
    title: "Comunicados / Avisos",
    module: "comunicacao",
    description: "Criação e publicação de avisos no portal para a comunidade escolar.",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    aliases: ["comunicados", "avisos", "criar aviso", "notificações", "mensagens"],
    href: (schoolId) => `/escola/${schoolId}/admin/avisos`,
  },
  {
    key: "documentos",
    title: "Documentos",
    module: "secretaria",
    description: "Emissão de declarações de frequência, boletins e outros documentos oficiais.",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    aliases: ["documentos", "declaração", "emitir declaração", "certidão", "documentos oficiais"],
    href: (schoolId) => `/escola/${schoolId}/secretaria/documentos`,
  },
  {
    key: "klasse_ai",
    title: "KLASSE AI",
    module: "classe_ai",
    description: "Painel administrativo do KLASSE AI, consumo de créditos e estatísticas.",
    roles: [
      "admin",
      "admin_escola",
      "staff_admin",
      "secretaria",
      "financeiro",
      "admin_financeiro",
      "secretaria_financeiro",
      "direcao",
      "diretoria",
    ],
    aliases: ["klasse ai", "ia", "painel ia", "créditos ia", "configurar ia", "assistente virtual"],
    href: (schoolId) => `/escola/${schoolId}/admin/ai`,
  },
  {
    key: "central_acoes_ai",
    title: "Central de Ações IA",
    module: "classe_ai",
    description: "Gerenciar rascunhos de comunicados, planos de cobrança e resumos gerados por IA.",
    roles: [
      "admin",
      "admin_escola",
      "staff_admin",
      "secretaria",
      "financeiro",
      "admin_financeiro",
      "secretaria_financeiro",
      "direcao",
      "diretoria",
    ],
    aliases: ["central de ações", "ações ia", "rascunhos ia", "aprovar rascunhos", "ações do assistente"],
    href: (schoolId) => `/escola/${schoolId}/admin/ai/actions`,
  },
  {
    key: "central_whatsapp",
    title: "Central WhatsApp",
    module: "whatsapp",
    description: "Visualizar conversas, status da conexão e rascunhos pendentes de envio pelo WhatsApp.",
    roles: [
      "admin",
      "admin_escola",
      "staff_admin",
      "secretaria",
      "financeiro",
      "admin_financeiro",
      "secretaria_financeiro",
      "direcao",
      "diretoria",
    ],
    aliases: ["central whatsapp", "whatsapp", "inbox whatsapp", "mensagens whatsapp", "conversas"],
    href: (schoolId) => `/escola/${schoolId}/admin/comunicacao/whatsapp`,
  },
  {
    key: "configuracao_whatsapp",
    title: "Configuração WhatsApp",
    module: "whatsapp",
    description: "Configuração da API do WhatsApp (WAHA) e vinculação de dispositivo via QR Code.",
    roles: ["admin", "admin_escola", "staff_admin", "direcao", "diretoria"],
    aliases: ["configurar whatsapp", "qr code whatsapp", "conectar whatsapp", "waha", "configuração de comunicação"],
    href: (schoolId) => `/escola/${schoolId}/admin/configuracoes/comunicacao`,
  },
  {
    key: "acesso_alunos",
    title: "Acesso de Alunos",
    module: "secretaria",
    description: "Gerenciar credenciais de acesso dos alunos ao Portal do Aluno.",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    aliases: ["acesso de alunos", "liberar acesso", "credenciais alunos", "login alunos", "senha alunos"],
    href: (schoolId) => `/escola/${schoolId}/secretaria/acesso`,
  },
];

export function getRoutesForRole(role: string): KlasseRoute[] {
  const cleanRole = role.toLowerCase().trim();
  return KLASSE_ROUTES.filter((r) => r.roles.includes(cleanRole));
}
