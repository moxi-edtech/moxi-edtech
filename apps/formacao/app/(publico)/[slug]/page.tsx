import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Geist_Mono, Sora } from "next/font/google";
import { LandingContent } from "./LandingContent";

export const revalidate = 60;

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

type Props = {
  params: Promise<{ slug: string }>;
};

type LandingTenantType = "formacao" | "solo_creator";

type LandingExperience = {
  badge: string;
  title: string;
  description: string;
  footerLabel: string;
};

type LandingCohort = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome: string;
  format: "PRESENCIAL" | "ONLINE" | "GRAVADO";
  valor_referencia: number;
  vagas: number;
  vagas_ocupadas: number;
  carga_horaria: number;
  data_inicio: string;
};

type LandingPayload = {
  escola: {
    id: string;
    nome: string;
    slug: string;
    logo_url: string | null;
    tenant_type: LandingTenantType;
  };
  fiscal: null;
  cohorts: LandingCohort[];
};

function resolveLandingExperience(tenantType: LandingTenantType): LandingExperience {
  if (tenantType === "solo_creator") {
    return {
      badge: "Mentorias e Eventos",
      title: "Transforme a sua carreira com mentorias práticas",
      description:
        "Programas orientados por especialistas para acelerar resultados reais. Escolha a próxima edição e reserve o seu lugar.",
      footerLabel: "Mentor(a) parceiro(a) KLASSE",
    };
  }

  return {
    badge: "Inscrições Abertas",
    title: "Acelere a sua carreira com formação certificada",
    description:
      "Cursos práticos e certificados para transformar o seu futuro profissional. Escolha a sua área e garanta a sua vaga hoje mesmo.",
    footerLabel: "Centro de Formação parceiro KLASSE",
  };
}

async function getCentroData(slug: string): Promise<LandingPayload | null> {
  const supabaseUrl = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = String(
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ).trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("get_public_landing_data", { p_slug: slug });
  if (error || !data) return null;

  return data as LandingPayload;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCentroData(slug);
  if (!data) return { title: "Centro não encontrado" };
  const experience = resolveLandingExperience(data.escola.tenant_type);

  return {
    title: `${data.escola.nome} · ${experience.badge}`,
    description: experience.description,
  };
}

export default async function PublicCentroLandingPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCentroData(slug);
  if (!data) notFound();

  const tenantType = data.escola.tenant_type;
  const experience = resolveLandingExperience(tenantType);

  return (
    <div className={`${sora.variable} ${geistMono.variable} min-h-screen bg-slate-950 text-slate-100`}>
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {data.escola.logo_url ? (
              <Image
                src={data.escola.logo_url}
                alt={data.escola.nome}
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-klasse-gold font-black text-slate-950">
                {data.escola.nome.charAt(0)}
              </div>
            )}
            <span className="text-lg font-black tracking-tight [font-family:var(--font-sora)]">{data.escola.nome}</span>
          </div>

          <Link
            href="/login"
            className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-bold text-slate-200 transition-all hover:border-white/40 hover:bg-white/10"
          >
            Entrar no Portal
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative z-10 text-center">
            <div className="inline-flex rounded-full bg-klasse-gold/15 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-klasse-gold [font-family:var(--font-geist-mono)]">
              {experience.badge}
            </div>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-6xl [font-family:var(--font-sora)]">
              {experience.title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">{experience.description}</p>
          </div>
        </div>
        <div className="absolute left-1/2 top-0 -z-10 h-[520px] w-[880px] -translate-x-1/2 rounded-full bg-klasse-gold/10 blur-[120px]" />
      </section>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <LandingContent
          tenantType={tenantType}
          centro={{ id: data.escola.id, slug: data.escola.slug, nome: data.escola.nome, logo_url: data.escola.logo_url }}
          fiscal={data.fiscal}
          cohorts={data.cohorts}
        />

        <section className="mt-32 grid gap-12 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/5 bg-white/5 p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-klasse-gold/20 text-klasse-gold">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mt-6 text-xl font-bold text-white">Certificação Válida</h3>
            <p className="mt-4 leading-relaxed text-slate-400">Ao concluir a formação com sucesso, terá acesso a um certificado reconhecido para impulsionar o seu currículo.</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-white/5 p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-klasse-gold/20 text-klasse-gold">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mt-6 text-xl font-bold text-white">Flexibilidade Total</h3>
            <p className="mt-4 leading-relaxed text-slate-400">Escolha entre formatos presenciais, online ou gravados que se adaptam perfeitamente à sua rotina diária.</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-white/5 p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-klasse-gold/20 text-klasse-gold">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="mt-6 text-xl font-bold text-white">Pagamento Facilitado</h3>
            <p className="mt-4 leading-relaxed text-slate-400">Processo de inscrição simplificado com confirmação rápida via transferência bancária ou depósito.</p>
          </div>
        </section>

        <section className="mt-32">
          <div className="text-center">
            <h2 className="text-3xl font-black text-white sm:text-4xl">Dúvidas Frequentes</h2>
            <p className="mt-4 text-slate-400">Tudo o que precisa de saber para começar a sua jornada.</p>
          </div>
          <div className="mx-auto mt-16 max-w-3xl divide-y divide-white/5">
            <div className="py-6">
              <h4 className="text-lg font-bold text-white">Como recebo o acesso ao curso?</h4>
              <p className="mt-3 leading-relaxed text-slate-400">Após o envio do comprovativo, a nossa secretaria validará o pagamento em até 24h úteis. Receberá as credenciais de acesso por e-mail ou SMS.</p>
            </div>
            <div className="py-6">
              <h4 className="text-lg font-bold text-white">Os cursos têm suporte dos formadores?</h4>
              <p className="mt-3 leading-relaxed text-slate-400">Sim, todos os nossos programas incluem canais de dúvida direto com os especialistas para garantir a sua aprendizagem.</p>
            </div>
            <div className="py-6">
              <h4 className="text-lg font-bold text-white">Posso solicitar fatura da minha inscrição?</h4>
              <p className="mt-3 leading-relaxed text-slate-400">Com certeza. Basta solicitar à secretaria através do portal do aluno após a confirmação da sua matrícula.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-slate-400">
            © 2026 {data.escola.nome} · {experience.footerLabel}
          </p>
        </div>
      </footer>
    </div>
  );
}
