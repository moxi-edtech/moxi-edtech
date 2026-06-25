export interface HelpTopic {
  key: string;
  title: string;
  aliases: string[];
  category: "Secretaria" | "Financeiro" | "Administração" | "Acadêmico" | "Comunicação" | "KLASSE AI";
  roles: string[];
  answer: string;
  steps: string[];
  href?: (schoolId: string) => string;
}

export const KLASSE_HELP_TOPICS: HelpTopic[] = [
  {
    key: "dashboard_admin",
    title: "Acessar o Painel Geral / Dashboard",
    aliases: ["dashboard", "painel", "resumo", "inicio", "página inicial"],
    category: "Administração",
    roles: ["admin", "admin_escola", "staff_admin", "direcao", "diretoria"],
    answer: "Acesse o painel geral da escola para visualizar indicadores operacionais rápidos.",
    steps: [
      "Acesse a página inicial do portal.",
      "Clique no menu principal ou no logotipo para ir para o Dashboard."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/admin`
  },
  {
    key: "cadastrar_aluno",
    title: "Cadastrar Novo Aluno",
    aliases: ["novo aluno", "matricular aluno", "adicionar aluno", "cadastro aluno", "matrícula"],
    category: "Secretaria",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    answer: "Para cadastrar um novo aluno, acesse Secretaria > Alunos > Novo Aluno.",
    steps: [
      "No menu lateral, selecione Secretaria.",
      "Clique na opção Alunos.",
      "Clique em Novo (ou Novo Aluno).",
      "Preencha as informações obrigatórias e salve o cadastro."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/secretaria/alunos/novo`
  },
  {
    key: "listar_alunos",
    title: "Listar ou Procurar Alunos",
    aliases: ["procurar aluno", "buscar aluno", "lista de alunos", "pesquisar aluno", "alunos"],
    category: "Secretaria",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "financeiro", "admin_financeiro", "secretaria_financeiro", "direcao", "diretoria"],
    answer: "Pesquise os alunos cadastrados e aceda às suas fichas detalhadas.",
    steps: [
      "Acesse Secretaria ou Painel no menu lateral.",
      "Clique em Alunos para ver a listagem.",
      "Utilize a barra de pesquisa para filtrar por nome ou número de matrícula."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/secretaria/alunos`
  },
  {
    key: "listar_turmas",
    title: "Ver ou Criar Turmas",
    aliases: ["turmas", "criar turma", "nova turma", "ver turmas", "classes"],
    category: "Acadêmico",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    answer: "Acesse a seção de turmas para ver a distribuição de alunos e gerenciar salas.",
    steps: [
      "No menu lateral, selecione Secretaria.",
      "Clique em Turmas.",
      "Você verá a lista de turmas ativas ou poderá criar uma nova."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/secretaria/turmas`
  },
  {
    key: "ver_inadimplentes",
    title: "Ver Inadimplentes (Radar de Cobrança)",
    aliases: ["inadimplentes", "radar", "atrasados", "devedores", "propinas atrasadas", "cobrança"],
    category: "Financeiro",
    roles: ["admin", "admin_escola", "staff_admin", "financeiro", "admin_financeiro", "secretaria_financeiro", "direcao", "diretoria"],
    answer: "Acesse o Radar de Inadimplência para identificar cobranças em atraso e acionar a IA de cobrança.",
    steps: [
      "No menu lateral, selecione Financeiro.",
      "Clique em Radar.",
      "Visualize a lista de devedores e propinas pendentes."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/financeiro/radar`
  },
  {
    key: "lancar_pagamento",
    title: "Lançar Pagamento / Propinas",
    aliases: ["lançar pagamento", "receber propina", "pagar mensalidade", "receber pagamento", "recibo"],
    category: "Financeiro",
    roles: ["admin", "admin_escola", "staff_admin", "financeiro", "admin_financeiro", "secretaria_financeiro"],
    answer: "Para efetuar lançamentos de pagamentos de propinas ou outras taxas administrativas.",
    steps: [
      "Selecione o menu Financeiro.",
      "Clique na opção Pagamentos.",
      "Selecione o aluno e o mês correspondente, insira o valor e registre o pagamento."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/financeiro/pagamentos`
  },
  {
    key: "criar_comunicado",
    title: "Criar Comunicado ou Aviso",
    aliases: ["comunicado", "criar aviso", "novo comunicado", "enviar mensagem", "avisos"],
    category: "Comunicação",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    answer: "Para publicar comunicados e avisos no portal para alunos e encarregados, com suporte da IA para polimento.",
    steps: [
      "No menu lateral, selecione Administração.",
      "Selecione Avisos.",
      "Clique em Novo e escreva o rascunho."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/admin/avisos/novo`
  },
  {
    key: "abrir_klasse_ai",
    title: "Aceder ao Dashboard KLASSE AI",
    aliases: ["assistente", "klasse ai", "dashboard ai", "painel ia", "créditos ia", "configurar ia"],
    category: "KLASSE AI",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "financeiro", "admin_financeiro", "secretaria_financeiro", "direcao", "diretoria"],
    answer: "Para acompanhar o consumo de créditos de IA da escola, ver logs de uso e gerenciar configurações.",
    steps: [
      "Selecione Administração no menu lateral.",
      "Clique na opção KLASSE AI.",
      "Visualize estatísticas de uso diário/mensal e feedbacks."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/admin/ai`
  },
  {
    key: "lancar_notes",
    title: "Lançar Notas / Pautas",
    aliases: ["notas", "pautas", "lançar notas", "cadastrar notas", "avaliacoes"],
    category: "Acadêmico",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    answer: "Permite a visualização e lançamento de notas escolares diretamente no sistema.",
    steps: [
      "Selecione Administração no menu lateral.",
      "Acesse a página de Notas.",
      "Selecione a turma, período e disciplina para registrar as avaliações."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/admin/notas`
  },
  {
    key: "registrar_presenca",
    title: "Registrar Presença / Frequência",
    aliases: ["presença", "frequência", "faltas", "registrar presença", "calendário faltas"],
    category: "Acadêmico",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    answer: "Para consultar e registrar faltas de alunos por dia letivo ou turma.",
    steps: [
      "Acesse Secretaria no menu lateral.",
      "Clique em Calendário.",
      "Selecione a data e a turma correspondente para efetuar a chamada."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/secretaria/calendario`
  },
  {
    key: "emitir_declaracao",
    title: "Emitir Declaração ou Documento Oficial",
    aliases: ["declaração", "emitir documento", "documentos", "boletim", "certidão"],
    category: "Secretaria",
    roles: ["admin", "admin_escola", "staff_admin", "secretaria", "direcao", "diretoria"],
    answer: "Para gerar declarações de frequência, boletins ou cartões de estudantes.",
    steps: [
      "No menu lateral, clique em Secretaria.",
      "Selecione a opção Documentos.",
      "Selecione o tipo de documento, filtre pelo aluno e faça o download."
    ],
    href: (schoolId: string) => `/escola/${schoolId}/secretaria/documentos`
  }
];

export function findHelpTopics(query: string, role: string): HelpTopic[] {
  const cleanQuery = query.toLowerCase().trim();
  const userRole = role.toLowerCase().trim();

  // Filter topics allowed for the current role
  const allowedTopics = KLASSE_HELP_TOPICS.filter((topic) => {
    return topic.roles.map((r) => r.toLowerCase()).includes(userRole);
  });

  if (!cleanQuery) {
    // If no query, return the first 5 popular topics allowed for the role
    return allowedTopics.slice(0, 5);
  }

  // Filter based on cleanQuery matches in title, aliases, or category
  const filtered = allowedTopics.filter((topic) => {
    const titleMatch = topic.title.toLowerCase().includes(cleanQuery);
    const categoryMatch = topic.category.toLowerCase().includes(cleanQuery);
    const aliasMatch = topic.aliases.some((alias) => alias.toLowerCase().includes(cleanQuery));

    return titleMatch || categoryMatch || aliasMatch;
  });

  return filtered.slice(0, 5);
}
