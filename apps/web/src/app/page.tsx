import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  Check,
  ClipboardCheck,
  LayoutDashboard,
  Library,
  Shield,
  Users,
  UserCheck,
  UsersRound,
  Wallet,
} from "lucide-react";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://klasse.ao";
const appSiteUrl = process.env.NEXT_PUBLIC_APP_SITE_URL ?? "https://app.klasse.ao";
const socialImage = `${siteUrl}/new.PNG`;
const demoHref = "mailto:demo@klasse.ao?subject=Pedido%20de%20demo%20KLASSE";
const appHref = `${appSiteUrl}/login`;

export const metadata: Metadata = {
  title: "Sistema de gestão escolar em Angola para escolas e redes escolares modernas",
  description:
    "KLASSE é a plataforma de gestão escolar em Angola para propinas, matrículas, notas e presenças com operação moderna, multi-escola e foco em execução real.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "KLASSE — plataforma escolar moderna para escolas e redes em Angola",
    description:
      "Sistema de gestão escolar em Angola para direção, secretaria, financeiro e professores com foco em controlo, velocidade e multi-escola.",
    url: "/",
    images: [
      {
        url: socialImage,
        width: 1536,
        height: 1024,
        alt: "KLASSE — plataforma escolar moderna em Angola",
      },
    ],
  },
  twitter: {
    title: "KLASSE — plataforma escolar moderna em Angola",
    description:
      "Software de gestão escolar com propinas, matrículas, notas, presenças e operação multi-escola.",
    images: [socialImage],
  },
};

const differentiators = [
  {
    title: "Operação moderna",
    description: "KLASSE foi pensado para equipas que não podem perder tempo com processos manuais, interfaces antigas e fluxo quebrado.",
    icon: LayoutDashboard,
  },
  {
    title: "Execução conectada",
    description: "Secretaria, financeiro, direção e professores trabalham na mesma base, sem ruído entre áreas críticas.",
    icon: Library,
  },
  {
    title: "Escala multi-escola",
    description: "Uma plataforma para uma escola ou para uma rede inteira, com estrutura pronta para crescer com controlo.",
    icon: BarChart3,
  },
];

const productAreas = [
  {
    title: "Gestão de propinas",
    description: "Cobrança, atrasos, pagamentos e previsibilidade financeira com menos improviso.",
    icon: Wallet,
  },
  {
    title: "Matrículas",
    description: "Admissões, rematrículas, documentos e confirmação de vagas com mais velocidade operacional.",
    icon: UsersRound,
  },
  {
    title: "Notas",
    description: "Avaliações e histórico académico com menos retrabalho entre secretaria e professores.",
    icon: ClipboardCheck,
  },
  {
    title: "Presenças",
    description: "Frequência e faltas com leitura rápida para ação pedagógica e gestão diária.",
    icon: CalendarCheck,
  },
];

const personas = [
  {
    title: "Direção",
    icon: Shield,
    items: [
      "Mais controlo sobre a escola ou grupo escolar sem depender de relatórios manuais.",
      "Melhor leitura de gargalos antes de virarem crise operacional.",
    ],
  },
  {
    title: "Secretaria",
    icon: Users,
    items: [
      "Fluxos de matrícula, rematrícula e documentos com menos retrabalho.",
      "Histórico e operação diária mais organizados e previsíveis.",
    ],
  },
  {
    title: "Financeiro",
    icon: Wallet,
    items: [
      "Gestão de propinas com mais visibilidade e menos ruído entre cobrança e secretaria.",
      "Base melhor para acompanhar pagamentos e inadimplência com disciplina.",
    ],
  },
  {
    title: "Professores",
    icon: UserCheck,
    items: [
      "Notas e presenças sem fricção com o resto da operação escolar.",
      "Mais rapidez para lançar informação e menos dependência de rotinas informais.",
    ],
  },
];

const objections = [
  {
    question: "Já temos sistema. Porque trocar?",
    answer:
      "Ter sistema não significa ter controlo. Se a escola ainda vive de planilhas, confirmações manuais e retrabalho entre áreas, o problema continua em aberto.",
  },
  {
    question: "O nosso maior problema é financeiro. KLASSE resolve isso?",
    answer:
      "Sim. O posicionamento do KLASSE não é só académico. A plataforma foi pensada para ligar propinas, pagamentos, matrícula e operação de secretaria na mesma base.",
  },
  {
    question: "Serve para uma rede escolar ou só para uma escola?",
    answer:
      "Serve para os dois cenários. O KLASSE já entra no mercado com narrativa e estrutura para multi-escola, sem sacrificar clareza operacional por unidade.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "KLASSE",
      url: siteUrl,
      logo: `${siteUrl}/logo-klasse.png`,
      image: socialImage,
      areaServed: { "@type": "Country", name: "Angola" },
    },
    {
      "@type": "SoftwareApplication",
      name: "KLASSE",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "EducationManagementSoftware",
      operatingSystem: "Web",
      url: siteUrl,
      image: socialImage,
      description:
        "Plataforma de gestão escolar em Angola para propinas, matrículas, notas, presenças e operação multi-escola com experiência moderna.",
      areaServed: { "@type": "Country", name: "Angola" },
      featureList: [
        "Gestão de propinas",
        "Matrículas",
        "Notas",
        "Presenças",
        "Secretaria escolar",
        "Gestão multi-escola",
      ],
    },
  ],
};

export default function Page() {
  const appLabel = "Aceder à aplicação";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <section className="border-b border-white/10 bg-gradient-to-b from-slate-950 via-slate-950 to-klasse-green/10">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
            <header className="flex flex-col gap-6 rounded-xl border border-white/10 bg-slate-950/80 p-6 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">KLASSE</p>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Plataforma SaaS de gestão escolar para escolas privadas e redes escolares que querem crescer com mais controlo e menos caos.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={demoHref}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-klasse-gold px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
                >
                  Agendar demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={appHref}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-klasse-gold hover:text-klasse-green"
                >
                  {appLabel}
                </Link>
              </div>
            </header>

            <div className="grid gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center rounded-full border border-klasse-gold/30 bg-klasse-gold/10 px-4 py-2 text-sm font-medium text-klasse-gold">
                  Sistema de gestão escolar em Angola para quem quer sair de processos manuais e operar com velocidade real.
                </div>
                <div className="space-y-6">
                  <h1 className="max-w-5xl text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
                    KLASSE é a plataforma escolar moderna para escolas e redes em Angola que querem controlar propinas, matrículas, notas e presenças sem sistemas pesados e fluxos antiquados.
                  </h1>
                  <p className="max-w-3xl text-lg leading-8 text-slate-300">
                    Se a sua operação ainda depende de confirmações manuais, interfaces que travam a equipa e processos quebrados entre secretaria e financeiro, o problema não é falta de esforço. É falta de plataforma certa.
                  </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link
                    href={demoHref}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-klasse-gold px-6 py-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
                  >
                    Ver KLASSE na prática
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/redes-escolares"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:border-klasse-gold hover:text-klasse-green"
                  >
                    Ver solução multi-escola
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/80 p-6 shadow-sm">
                <div className="flex items-center gap-3 text-klasse-gold">
                  <BookOpen className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-[0.24em]">Porque KLASSE ganha</span>
                </div>
                <div className="mt-6 space-y-4 text-sm leading-6 text-slate-300">
                  <p>Mais moderno do que sistemas que ainda parecem pesados, manuais e lentos para a equipa.</p>
                  <p>Mais disciplinado na ligação entre direção, secretaria, financeiro e professores.</p>
                  <p>Mais preparado para uma escola ou uma rede inteira, sem perder clareza operacional.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">Posicionamento competitivo</p>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              O KLASSE não quer ser só mais um sistema escolar. Quer ser a opção mais moderna e mais séria para executar operação real.
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {differentiators.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
                  <div className="flex items-center gap-3 text-klasse-gold">
                    <Icon className="h-5 w-5" />
                    <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{item.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-white/10 bg-slate-900/60">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">Módulos críticos</p>
              <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
                É aqui que as escolas sentem o custo do caos — e é aqui que o KLASSE precisa vencer.
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {productAreas.map((area) => {
                const Icon = area.icon;

                return (
                  <article key={area.title} className="rounded-xl border border-white/10 bg-slate-950/80 p-6 shadow-sm">
                    <div className="flex items-center gap-3 text-klasse-gold">
                      <Icon className="h-5 w-5" />
                      <h3 className="text-lg font-semibold text-white">{area.title}</h3>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{area.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">Página por persona</p>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              O KLASSE precisa vender para quem decide e para quem executa todos os dias.
            </h2>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
            {personas.map((persona) => {
              const Icon = persona.icon;

              return (
                <article key={persona.title} className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-klasse-green/20 p-3 text-klasse-gold">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{persona.title}</h3>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
                    {persona.items.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <Check className="mt-1 h-4 w-4 flex-none text-klasse-gold" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-t border-white/10 bg-slate-950/90">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">Redes escolares</p>
                <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
                  Se o KLASSE quer vencer o mercado, precisa dominar a conversa de multi-escola antes dos outros.
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                  O ângulo mais forte para bater sistemas antigos e plataformas genéricas é mostrar que o KLASSE foi desenhado para escalar com controlo — por escola, por unidade e por grupo.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
                <div className="flex items-center gap-3 text-klasse-gold">
                  <UsersRound className="h-5 w-5" />
                  <h3 className="text-lg font-semibold text-white">Próximo passo comercial</h3>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  Criámos a página dedicada para redes escolares e grupos com várias unidades. Esse é o flanco onde o KLASSE pode parecer mais moderno, mais sério e mais escalável do que a concorrência.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/redes-escolares"
                    className="inline-flex items-center justify-center rounded-xl bg-klasse-gold px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
                  >
                    Abrir página multi-escola
                  </Link>
                  <Link
                    href={demoHref}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-klasse-gold hover:text-klasse-green"
                  >
                    Falar com comercial
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">Objeções</p>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              Quando o mercado hesita, o KLASSE precisa responder com clareza e sem rodeios.
            </h2>
          </div>

          <div className="mt-10 space-y-4">
            {objections.map((item) => (
              <article key={item.question} className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
