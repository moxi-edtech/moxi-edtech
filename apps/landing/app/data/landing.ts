export const navLinks = [
  { href: '#produto', label: 'Produto' },
  { href: '#portais', label: 'Portais' },
  { href: '#para-quem', label: 'Para quem é' },
  { href: '#precos', label: 'Preços' },
]

export const hero = {
  eyebrow: 'Sistema de gestão escolar feito para Angola',
  titleLines: ['A escola que você gere', 'merece um sistema claro', 'e feito para si'],
  subtitle:
    'Estamos a lançar em Angola com um sistema de gestão escolar pensado para a nossa realidade e acompanhamos cada escola de perto.',
  primaryCta: 'Quero começar com o formulário',
  secondaryCta: 'Quero falar primeiro',
  note: 'Sem compromisso · Acompanhamento pessoal da equipa',
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
    title: 'Gestão completa num só lugar',
    description:
      'Controlo de propinas, alunos e documentos MED num sistema simples para a secretaria escolar digital.',
  },
  {
    title: 'Fluxo claro do início ao fim',
    description:
      'Da matrícula escolar digital ao relatório mensal, tudo segue um fluxo lógico que evita erros e retrabalho.',
  },
  {
    title: 'Acompanhamento na implementação',
    description:
      'A equipa KLASSE acompanha a sua escola nos primeiros passos para garantir que o sistema escolar em Angola fica bem configurado.',
  },
  {
    title: 'Direcção com visão real da escola',
    description:
      'O director vê o estado da escola em tempo real e decide com confiança, sem esperar relatórios manuais.',
  },
]

export const audienceCards = [
  {
    title: 'Director que precisa de visão clara',
    description:
      'Quer tomar decisões com dados certos, sem esperar dias por relatórios manuais.',
  },
  {
    title: 'Secretaria sobrecarregada',
    description:
      'Precisa de reduzir filas, organizar documentos do MED e ganhar tempo no atendimento com secretaria escolar digital.',
  },
  {
    title: 'Escola em crescimento',
    description:
      'A base está pronta, mas precisa de controlo real para crescer com segurança.',
  },
]

export const productSteps = [
  {
    title: 'Preenche o formulário',
    description: 'Conte-nos sobre a sua escola, turmas e número de alunos.',
  },
  {
    title: 'Configuramos o sistema',
    description: 'A nossa equipa monta tudo e valida consigo.',
  },
  {
    title: 'Importamos os alunos',
    description: 'Recebe o modelo Excel e ajudamos na importação.',
  },
]

export const pricingIntro =
  'Nenhuma funcionalidade principal é bloqueada por plano. Os limites são de capacidade (alunos, armazenamento e utilizadores), não de acesso.'

export const pricingNote =
  'Uma escola Essencial tem o Balcão Inteligente, o portal da direção e os documentos MED — só não consegue registar mais de 600 alunos.'

export const portals = [
  {
    id: 'director',
    title: 'Portal do Director',
    description:
      'Visão completa da escola. Aprova turmas, vê relatórios financeiros e académicos, acompanha o estado em tempo real.',
    items: [
      'Dashboard com indicadores chave',
      'Aprovação de turmas e matrículas',
      'Relatórios mensais automáticos',
    ],
  },
  {
    id: 'secretaria',
    title: 'Portal da Secretaria',
    description:
      'Balcão de atendimento inteligente. Matricula alunos, regista pagamentos e emite documentos sem sair do mesmo ecrã.',
    items: ['Pesquisa rápida de alunos', 'Registo de pagamentos', 'Emissão de documentos MED'],
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
    title: 'Portal Financeiro',
    description:
      'Controlo completo das receitas. Propinas, matrículas e serviços — com alertas automáticos de cobranças em atraso.',
    items: ['Controlo de propinas em tempo real', 'Relatórios de receita mensal', 'Alertas de cobranças em atraso'],
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
    badge: 'Portal do Professor',
    title: ['O professor lança.', 'O director vê na hora.'],
    description:
      'Sem papel para recolher, sem notas para transcrever. O professor abre o telemóvel, selecciona a turma e regista presenças ou notas em segundos.',
    features: [
      {
        title: 'Lista de turma',
        description: 'Todos os alunos com foto, número de processo e histórico de presenças.',
      },
      {
        title: 'Registo de presenças',
        description: 'Um toque por aluno. Presente, falta justificada ou injustificada.',
      },
      {
        title: 'Lançamento de notas',
        description: 'Por disciplina e período. O sistema calcula médias automaticamente.',
      },
    ],
    hint: 'Optimizado para telemóvel — o professor não precisa de computador',
  },
  aluno: {
    badge: 'Portal do Aluno',
    title: ['O aluno acompanha', 'o seu próprio percurso.'],
    description:
      'Cada aluno tem acesso ao seu portal com notas, presenças e situação financeira. O encarregado acompanha também.',
    features: [
      {
        title: 'Notas e pautas',
        description: 'Resultados por período. O aluno sabe onde está sem esperar pela pauta em papel.',
      },
      {
        title: 'Registo de presenças',
        description: 'Histórico completo de faltas por disciplina antes de atingir o limite.',
      },
      {
        title: 'Situação financeira',
        description: 'Propinas pagas, pendentes e datas de vencimento sempre visíveis.',
      },
    ],
    loginHint: {
      label: 'Login do aluno',
      code: 'CSJ-00234',
      sub: 'Número de processo · sem email necessário',
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
  { href: '#', label: 'Termos de Serviço' },
  { href: '#', label: 'Política de Privacidade' },
  { href: '#', label: 'Suporte' },
  { href: '#', label: 'Contacto' },
]
