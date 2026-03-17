export const navLinks = [
  { href: '#produto', label: 'Produto' },
  { href: '#portais', label: 'Portais' },
  { href: '#para-quem', label: 'Para quem é' },
  { href: '#precos', label: 'Preços' },
]

export const hero = {
  eyebrow: 'Sistema de gestão escolar para a sua secretaria',
  titleLines: ['A secretaria que a sua escola', 'merecia desde sempre.'],
  subtitle:
    'Matrículas, propinas, notas e documentos MED — num só lugar. Sem papel, sem Excel, sem confusão.',
  primaryCta: 'Quero testar 2 meses grátis',
  secondaryCta: 'Fale connosco',
  note: 'Sem compromisso. A nossa equipa configura tudo consigo.',
}

export const heroMockup = {
  stats: [
    { value: '583', label: 'Alunos', tone: 'green' as const },
    { value: 'Kz 4.2M', label: 'Kz Cobrado', tone: 'gold' as const },
    { value: '24', label: 'Turmas', tone: 'default' as const },
  ],
  rows: [
    { name: 'João Manuel · TI-10-M-A', status: 'Pago', statusTone: 'ok' as const },
    { name: 'Maria Antónia · ESG-9-T-B', status: 'Pendente', statusTone: 'pen' as const },
    { name: 'Pedro Afonso · EP-6-M-C', status: 'Pago', statusTone: 'ok' as const },
    { name: 'Ana Silva · CFB-11-M-A', status: '35 dias atraso', statusTone: 'late' as const },
  ],
  floatingBadges: [
    { label: 'Propinas cobradas', value: 'Kz 4.2M', sub: 'Outubro 2026', tone: 'green' as const },
    { label: 'Alunos activos', value: '583', sub: 'Ano lectivo 2026' },
  ],
}

export const productCards = [
  {
    title: 'Secretaria sem filas',
    description: 'Matrículas, documentos MED e pagamentos num único ecrã.',
  },
  {
    title: 'Financeiro sempre visível',
    description: 'Propinas pagas, pendentes e em atraso — sem abrir um caderno.',
  },
  {
    title: 'Director com visão real',
    description: 'Relatórios em tempo real para decidir hoje, não na semana que vem.',
  },
  {
    title: 'Implementação acompanhada',
    description: 'Configuramos o sistema consigo para a escola não ficar sozinha.',
  },
]

export const audienceCards = [
  {
    title: 'Director',
    description: 'Quer saber o estado da escola sem esperar relatório.',
  },
  {
    title: 'Secretaria',
    description: 'Responde às mesmas perguntas e procura papéis.',
  },
  {
    title: 'Escola em crescimento',
    description: 'Excel funcionava com 100 alunos, com 400 já não.',
  },
]

export const productSteps = [
  {
    title: 'Conta-nos sobre a escola',
    description: 'Partilhe turmas, número de alunos e o processo atual da secretaria.',
  },
  {
    title: 'Configuramos tudo',
    description: 'Montamos o sistema e validamos consigo antes do arranque.',
  },
  {
    title: 'A escola começa a usar',
    description: 'com os alunos importados e a equipa treinada.',
  },
]

export const pricingIntro =
  'Nenhuma funcionalidade principal é bloqueada por plano. Os limites são de capacidade (alunos, armazenamento e utilizadores), não de acesso.'

export const pricingNote =
  'Uma escola Essencial tem o Balcão Inteligente, o portal da direção e os documentos MED — só não consegue registar mais de 600 alunos.'

export const portals = [
  {
    id: 'director',
    title: 'Director',
    description: 'Vê indicadores, turmas e alertas sem esperar relatório.',
    items: ['Indicadores em tempo real', 'Aprovação de turmas', 'Visão académica e financeira'],
  },
  {
    id: 'secretaria',
    title: 'Secretaria',
    description: 'Atende, matricula e emite documentos no mesmo ecrã.',
    items: ['Matrículas rápidas', 'Documentos MED', 'Pagamentos no balcão'],
  },
  {
    id: 'professor',
    title: 'Portal do Professor',
    description:
      'Desenhado para mobile. Lança notas e presenças entre aulas, vê a lista da turma antes de entrar na sala.',
    items: ['Lançamento de notas por disciplina', 'Registo de presenças', 'Lista de alunos por turma'],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    description: 'Controla propinas, pendências e cobranças em atraso.',
    items: ['Propinas por estado', 'Cobranças em atraso', 'Receita mensal'],
  },
  {
    id: 'aluno',
    title: 'Portal do Aluno e Encarregado',
    description:
      'Portal do aluno em Angola para acompanhar o próprio percurso e o encarregado acompanha também, sem ir à escola.',
    items: ['Notas e pautas', 'Presenças por disciplina', 'Situação financeira'],
  },
]

export const portalHighlights = {
  professor: {
    badge: 'Professor',
    title: ['Professor', 'Tudo em poucos toques.'],
    description: 'Lança tudo da turma no telemóvel.',
    features: [
      {
        title: 'Presenças',
        description: 'Marca faltas em segundos.',
      },
      {
        title: 'Notas',
        description: 'Regista avaliações por período.',
      },
      {
        title: 'Turma',
        description: 'Consulta a lista da turma.',
      },
    ],
    hint: 'Optimizado para telemóvel',
  },
  aluno: {
    badge: 'Aluno',
    title: ['Aluno', 'Tudo claro no portal.'],
    description: 'Acompanha o percurso sem ir à escola.',
    features: [
      {
        title: 'Notas',
        description: 'Vê resultados por período.',
      },
      {
        title: 'Presenças',
        description: 'Confirma faltas por disciplina.',
      },
      {
        title: 'Financeiro',
        description: 'Consulta pagamentos e pendências.',
      },
    ],
    loginHint: {
      label: 'Login do aluno',
      code: 'CSJ-00234',
      sub: 'Número de processo · sem email',
    },
  },
}

export const pilot = {
  badge: 'Lançamento em Angola',
  title: 'As primeiras escolas têm acompanhamento directo',
  description:
    'Não é um software que compras e configuras sozinho. Trabalhamos directamente contigo — configuração, formação e suporte nos primeiros meses.',
}

export interface PricingPlan {
  name: string
  slug: 'basic' | 'pro' | 'enterprise'
  description: string
  price: string | null
  priceNote: string
  saving: string | null
  capacity: {
    alunos: string
    utilizadores: string
    storage: string
  }
  features: string[]
  cta: string
  ctaHref: string
  featured: boolean
}

export const pricingPlans: PricingPlan[] = [
  {
    name: 'Essencial',
    slug: 'basic',
    description: 'O essencial para pôr a secretaria a trabalhar sem stress.',
    price: '80.000',
    priceNote: 'por mês',
    saving: '2 meses grátis no anual',
    capacity: {
      alunos: 'até 600',
      utilizadores: 'até 10',
      storage: '5 GB',
    },
    features: [
      'Todos os portais',
      'Documentos MED incluídos',
      'KLASSE Network: leitura',
      'Suporte por email em 48h',
      'SLA 99% uptime',
    ],
    cta: 'Escolher Essencial',
    ctaHref: '/onboarding',
    featured: false,
  },
  {
    name: 'Profissional',
    slug: 'pro',
    description: 'Para escolas que querem crescer com tudo organizado.',
    price: '140.000',
    priceNote: 'por mês',
    saving: '2 meses grátis no anual',
    capacity: {
      alunos: 'até 1500',
      utilizadores: 'até 30',
      storage: '20 GB',
    },
    features: [
      'Todos os portais',
      'Documentos MED incluídos',
      'KLASSE Network: leitura + contribuição',
      'Suporte por email 24h + chat',
      'SLA 99.5% uptime',
    ],
    cta: 'Escolher Profissional',
    ctaHref: '/onboarding',
    featured: true,
  },
  {
    name: 'Premium',
    slug: 'enterprise',
    description: 'Para redes escolares ou escolas com múltiplos campi.',
    price: null,
    priceNote: 'Negociado',
    saving: null,
    capacity: {
      alunos: 'Ilimitado',
      utilizadores: 'Ilimitado',
      storage: '100 GB+',
    },
    features: [
      'Todos os portais + API',
      'Documentos MED incluídos',
      'KLASSE Network completo',
      'Suporte dedicado',
      'SLA 99.9% uptime',
    ],
    cta: 'Fale conosco',
    ctaHref: '/onboarding',
    featured: false,
  },
]

export const footerLinks = [
  { href: '/sistema-de-gestao-escolar', label: 'Sistema de Gestão Escolar' },
  { href: '#', label: 'Termos de Serviço' },
  { href: '#', label: 'Política de Privacidade' },
  { href: '#', label: 'Suporte' },
  { href: '#', label: 'Contacto' },
]
