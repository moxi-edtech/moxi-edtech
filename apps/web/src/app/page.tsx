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

import { supabaseServer } from "@/lib/supabaseServer";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://klasse.ao";
const socialImage = `${siteUrl}/new.PNG`;
const demoHref = "mailto:demo@klasse.ao?subject=Pedido%20de%20demo%20KLASSE";

export const metadata: Metadata = {
  title: "Sistema de gestão escolar em Angola para escolas e redes escolares modernas",
  description:
    "KLASSE é a plataforma de gestão escolar em Angola para propinas, matrículas, notas e presenças com operação moderna, multi-escola e foco em execução real.",

export const metadata: Metadata = {
  title: "Sistema de gestão escolar em Angola, software de gestão escolar e plataforma escolar",
  description:
    "KLASSE é um sistema de gestão escolar em Angola e software de gestão escolar para propinas, matrículas, notas e presenças numa plataforma escolar única.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "KLASSE — plataforma escolar moderna para escolas e redes em Angola",
    description:
      "Sistema de gestão escolar em Angola para direção, secretaria, financeiro e professores com foco em controlo, velocidade e multi-escola.",
    title: "KLASSE — Sistema de gestão escolar em Angola e plataforma escolar para crescer com controlo",
    description:
      "Software de gestão escolar para escolas em Angola com gestão de propinas, matrículas, notas e presenças numa plataforma escolar única.",
    url: "/",
    images: [
      {
        url: socialImage,
        width: 1536,
        height: 1024,
        alt: "KLASSE — plataforma escolar moderna em Angola",
        alt: "KLASSE — sistema de gestão escolar em Angola",
      },
    ],
  },
  twitter: {
    title: "KLASSE — plataforma escolar moderna em Angola",
    description:
      "Software de gestão escolar com propinas, matrículas, notas, presenças e operação multi-escola.",
    title: "KLASSE — Sistema de gestão escolar em Angola",
    description:
      "Software de gestão escolar para propinas, matrículas, notas e presenças numa plataforma escolar única.",
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
const keywordBlocks = [
  {
    title: "Sistema de gestão escolar em Angola",
    description:
      "Uma operação escolar mais disciplinada para direção, secretaria, financeiro e professores, sem depender de processos manuais dispersos.",
    icon: LayoutDashboard,
  },
  {
    title: "Software de gestão escolar",
    description:
      "KLASSE liga fluxo académico e financeiro numa única base para escolas que precisam de controlo, rastreabilidade e execução séria.",
    icon: Library,
  },
  {
    title: "Plataforma escolar",
    description:
      "A plataforma escolar organiza propinas, matrículas, notas e presenças com clareza operacional para cada equipa.",
    icon: BarChart3,
  },
];

const productAreas = [
  {
    title: "Gestão de propinas",
    description: "Cobrança, atrasos, pagamentos e previsibilidade financeira com menos improviso.",
    description: "Cobranças, atrasos, pagamentos e visibilidade financeira sem folhas soltas.",
    icon: Wallet,
  },
  {
    title: "Matrículas",
    description: "Admissões, rematrículas, documentos e confirmação de vagas com mais velocidade operacional.",
    description: "Admissões, vagas, rematrículas e confirmação documental num fluxo mais previsível.",
    icon: UsersRound,
  },
  {
    title: "Notas",
    description: "Avaliações e histórico académico com menos retrabalho entre secretaria e professores.",
    description: "Avaliações, pautas e histórico académico com menos retrabalho entre secretaria e professores.",
    icon: ClipboardCheck,
  },
  {
    title: "Presenças",
    description: "Frequência e faltas com leitura rápida para ação pedagógica e gestão diária.",
    description: "Frequência e faltas com leitura rápida para equipa pedagógica e direção.",
    icon: CalendarCheck,
  },
];

const personas = [
  {
    title: "Direção",
    icon: Shield,
    items: [
      "Mais controlo sobre a escola ou grupo escolar sem depender de relatórios manuais.",
      "Mais controlo institucional sobre operação académica e financeira.",
      "Melhor leitura de gargalos antes de virarem crise operacional.",
    ],
  },
  {
    title: "Secretaria",
    icon: Users,
    items: [
      "Matrículas, documentos e histórico com menos duplicação manual.",
      "Fluxo diário mais rápido e menos dependente de planilhas paralelas.",
    ],
  },
  {
    title: "Financeiro",
    icon: Wallet,
    items: [
      "Gestão de propinas com mais previsibilidade e menos ruído operacional.",
      "Base melhor para cobrança, reconciliação e acompanhamento de inadimplência.",
    ],
  },
  {
    title: "Professores",
    icon: UserCheck,
    items: [
      "Lançamento de notas e presenças sem fricção informal com secretaria.",
      "Turmas e disciplinas mais organizadas para a rotina pedagógica.",
    ],
  },
];

const faqs = [
  {
    question: "KLASSE é um sistema de gestão escolar em Angola?",
    answer:
      "Sim. A proposta comercial e o copy da homepage foram alinhados para responder diretamente à procura por sistema de gestão escolar em Angola.",
  },
  {
    question: "É software de gestão escolar só para académico?",
    answer:
      "Não. A plataforma escolar cobre gestão de propinas, matrículas, notas e presenças, ligando operação académica e financeira.",
  },
  {
    question: "O login compete com a homepage pelas mesmas keywords?",
    answer:
      "Não. O /login continua marcado como página secundária de acesso, com metadata não indexável para evitar canibalização.",
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
      areaServed: {
        "@type": "Country",
        name: "Angola",
      },
      sameAs: [siteUrl],
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
        "Sistema de gestão escolar em Angola para gestão de propinas, matrículas, notas e presenças numa plataforma escolar única.",
      areaServed: {
        "@type": "Country",
        name: "Angola",
      },
      audience: {
        "@type": "Audience",
        geographicArea: {
          "@type": "Country",
          name: "Angola",
        },
      },
      featureList: [
        "Gestão de propinas",
        "Matrículas",
        "Notas",
        "Presenças",
        "Operação académica",
        "Operação financeira",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "AOA",
        availability: "https://schema.org/InStock",
      },
      brand: {
        "@type": "Brand",
        name: "KLASSE",
      },
    },
  ],
};

export default async function Page() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const appHref = user ? "/redirect" : "/login";
  const appLabel = user ? "Entrar no painel" : "Aceder ao sistema";

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
                  Software de gestão escolar para escolas que querem crescer com mais controlo e menos improviso operacional.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={appHref}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-klasse-gold px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
                >
                  {appLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="mailto:demo@klasse.ao?subject=Pedido%20de%20demo%20KLASSE"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-klasse-gold hover:text-klasse-green"
                >
                  Pedir demo
                </Link>
              </div>
            </header>

            <div className="grid gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center rounded-full border border-klasse-gold/30 bg-klasse-gold/10 px-4 py-2 text-sm font-medium text-klasse-gold">
                  Sistema de gestão escolar em Angola com foco comercial e execução operacional séria.
                </div>
                <div className="space-y-6">
                  <h1 className="max-w-5xl text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
                    KLASSE é o sistema de gestão escolar em Angola que funciona como software de gestão escolar e plataforma escolar para propinas, matrículas, notas e presenças.
                  </h1>
                  <p className="max-w-3xl text-lg leading-8 text-slate-300">
                    Se a sua escola ainda opera com Excel, WhatsApp e confirmações manuais, você está a perder margem.
                    KLASSE posiciona-se como plataforma escolar para dar previsibilidade à direção, velocidade à secretaria,
                    disciplina ao financeiro e fluidez aos professores.
                  </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link
                    href="mailto:demo@klasse.ao?subject=Pedido%20de%20demo%20KLASSE"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-klasse-gold px-6 py-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
                  >
                    Pedir demo
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={appHref}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:border-klasse-gold hover:text-klasse-green"
                  >
                    {appLabel}
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/80 p-6 shadow-sm">
                <div className="flex items-center gap-3 text-klasse-gold">
                  <BookOpen className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-[0.24em]">Proposta comercial</span>
                </div>
                <div className="mt-6 space-y-4 text-sm leading-6 text-slate-300">
                  <p>
                    Sistema de gestão escolar em Angola para escolas privadas e equipas que precisam de mais rigor operacional.
                  </p>
                  <p>
                    Software de gestão escolar com foco em propinas, matrículas, notas e presenças numa operação conectada.
                  </p>
                  <p>
                    Plataforma escolar que reduz ruído entre direção, secretaria, financeiro e professores.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">Intenção de pesquisa</p>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              Headings e copy visível alinhados com as pesquisas comerciais que queremos ganhar.
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {keywordBlocks.map((block) => {
              const Icon = block.icon;

              return (
                <article key={block.title} className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
                  <div className="flex items-center gap-3 text-klasse-gold">
                    <Icon className="h-5 w-5" />
                    <h3 className="text-xl font-semibold text-white">{block.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{block.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-white/10 bg-slate-900/60">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">Módulos com intenção comercial</p>
              <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
                O software de gestão escolar precisa mostrar claramente o que resolve.
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
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">Benefícios por persona</p>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              A homepage precisa vender para quem decide e para quem executa.
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

        <section className="mx-auto max-w-5xl px-6 pb-20 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">FAQ</p>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              FAQ para reforçar relevância e evitar canibalização entre homepage e login.
            </h2>
          </div>

          <div className="mt-10 space-y-4">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
