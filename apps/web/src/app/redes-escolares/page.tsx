import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, LayoutDashboard, Shield, UsersRound, Wallet } from "lucide-react";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "https://klasse.ao";
const appSiteUrl = process.env.NEXT_PUBLIC_APP_SITE_URL ?? "https://app.klasse.ao";
const socialImage = `${siteUrl}/new.PNG`;
const demoHref = "mailto:demo@klasse.ao?subject=Pedido%20de%20demo%20KLASSE%20-%20Redes%20Escolares";

export const metadata: Metadata = {
  title: "Plataforma multi-escola para redes escolares em Angola",
  description:
    "KLASSE é a plataforma multi-escola para redes escolares em Angola com propinas, matrículas, notas, presenças e controlo por unidade.",
  alternates: {
    canonical: "/redes-escolares",
  },
  openGraph: {
    title: "KLASSE para redes escolares — multi-escola com controlo real",
    description:
      "Plataforma de gestão escolar para grupos e redes com várias unidades, isolamento por escola e operação centralizada.",
    url: "/redes-escolares",
    images: [
      {
        url: socialImage,
        width: 1536,
        height: 1024,
        alt: "KLASSE para redes escolares em Angola",
      },
    ],
  },
};

const pillars = [
  {
    title: "Isolamento por escola",
    description: "Cada unidade mantém contexto, operação e governação próprios sem misturar dados críticos.",
    icon: Shield,
  },
  {
    title: "Controlo central",
    description: "A direção do grupo ganha visibilidade consolidada sem perder autonomia local por escola.",
    icon: BarChart3,
  },
  {
    title: "Operação padronizada",
    description: "Matrículas, propinas, notas e presenças seguem fluxos mais claros e repetíveis entre unidades.",
    icon: LayoutDashboard,
  },
];

const useCases = [
  "Redes escolares privadas com várias unidades.",
  "Grupos que querem padronizar secretaria e financeiro sem criar mais burocracia.",
  "Operações que precisam de consolidado por grupo e leitura por escola.",
  "Equipas que querem crescer sem empilhar sistemas pesados e pouco modernos.",
];

export default function RedesEscolaresPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-white/10 bg-gradient-to-b from-slate-950 via-slate-950 to-klasse-green/10">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <div className="max-w-4xl space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">KLASSE para redes escolares</p>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
              A plataforma multi-escola para grupos e redes escolares em Angola que querem crescer com controlo real.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-slate-300">
              Se a sua organização já opera mais do que uma escola, o risco deixa de ser só académico. Vira risco de governação, cobrança, visibilidade e consistência operacional. O KLASSE entra exatamente aí.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href={demoHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-klasse-gold px-6 py-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
              >
                Agendar demo multi-escola
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`${appSiteUrl}/login`}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:border-klasse-gold hover:text-klasse-green"
              >
                Aceder à aplicação
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">Porque isto importa</p>
          <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
            Multi-escola não é só ter várias escolas no mesmo sistema. É manter controlo sem virar caos.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <article key={pillar.title} className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
                <div className="flex items-center gap-3 text-klasse-gold">
                  <Icon className="h-5 w-5" />
                  <h3 className="text-xl font-semibold text-white">{pillar.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-300">{pillar.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-900/60">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-klasse-gold">Casos onde KLASSE vence</p>
              <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
                Onde os grupos escolares sentem mais dor, o KLASSE precisa ser claramente superior.
              </h2>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
                {useCases.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-1 h-4 w-4 flex-none text-klasse-gold" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/80 p-6 shadow-sm">
              <div className="flex items-center gap-3 text-klasse-gold">
                <UsersRound className="h-5 w-5" />
                <h3 className="text-lg font-semibold text-white">Mensagem comercial</h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                O KLASSE não quer só gerir uma escola. Quer ser a plataforma que permite a uma rede crescer com operação padronizada, leitura consolidada e autonomia por unidade.
              </p>
              <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm leading-7 text-slate-300">
                Isto é onde o teu multi-tenancy deixa de ser backend invisível e vira vantagem comercial que o mercado entende.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
            <div className="flex items-center gap-3 text-klasse-gold">
              <Wallet className="h-5 w-5" />
              <h3 className="text-lg font-semibold text-white">Financeiro por unidade</h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">Propinas e pagamentos com visibilidade por escola e visão consolidada para o grupo.</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
            <div className="flex items-center gap-3 text-klasse-gold">
              <UsersRound className="h-5 w-5" />
              <h3 className="text-lg font-semibold text-white">Secretaria padronizada</h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">Processos mais consistentes entre unidades, sem cada escola reinventar o fluxo.</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
            <div className="flex items-center gap-3 text-klasse-gold">
              <LayoutDashboard className="h-5 w-5" />
              <h3 className="text-lg font-semibold text-white">Leitura consolidada</h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">Indicadores para a gestão central sem sacrificar o detalhe operacional por escola.</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
            <div className="flex items-center gap-3 text-klasse-gold">
              <Shield className="h-5 w-5" />
              <h3 className="text-lg font-semibold text-white">Mais controlo</h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">Mais governação, menos dependência de processos informais e menos risco de caos à medida que a rede cresce.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
