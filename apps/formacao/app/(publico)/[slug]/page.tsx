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
  vagas: number;
  vagas_ocupadas: number;
  data_inicio: string;
  valor_referencia: number;
};

type LandingCourse = {
  id: string;
  nome: string;
  slug: string | null;
  area: string | null;
  modalidade: "presencial" | "online" | "hibrido";
  carga_horaria: number | null;
  thumbnail_url: string | null;
  video_url: string | null;
  objetivos: string[];
  requisitos: string[];
  seo_config: {
    title?: string;
    description?: string;
  };
  open_cohorts: LandingCohort[];
};

type LandingPayload = {
  escola: {
    id: string;
    nome: string;
    slug: string;
    logo_url: string | null;
    tenant_type: LandingTenantType;
    municipio?: string | null;
    provincia?: string | null;
  };
  fiscal: { iban?: string | null } | null;
  pagamento?: {
    ativo?: boolean;
    banco?: string | null;
    titular_conta?: string | null;
    iban?: string | null;
    numero_conta?: string | null;
    kwik_chave?: string | null;
    instrucoes_checkout?: string | null;
  } | null;
  publicacao?: {
    badge?: string;
    headline?: string;
    descricao?: string;
    banner_url?: string;
    instrucoes?: string;
    contactos?: {
      whatsapp?: string;
      telefone?: string;
      email?: string;
      endereco?: string;
    };
    redes_sociais?: {
      instagram?: string;
      facebook?: string;
      linkedin?: string;
      website?: string;
    };
    faq?: Array<{
      pergunta?: string;
      resposta?: string;
    }>;
  } | null;
  tracking?: {
    google_analytics_id?: string;
    meta_pixel_id?: string;
  };
  seo?: {
    title?: string;
    description?: string;
    keywords?: string;
  };
  testemunhos: Array<{
    autor_nome: string;
    autor_cargo?: string;
    autor_avatar_url?: string;
    conteudo: string;
    estrelas: number;
    curso_nome?: string;
  }>;
  courses: LandingCourse[];
};

function resolveLandingExperience(tenantType: LandingTenantType, escola: LandingPayload["escola"]): LandingExperience {
  const localSuffix = escola.municipio ? ` em ${escola.municipio}` : "";

  if (tenantType === "solo_creator") {
    return {
      badge: "Mentorias e Eventos",
      title: `Transforme a sua carreira${localSuffix}`,
      description:
        "Programas orientados por especialistas para acelerar resultados reais. Escolha a próxima edição e reserve o seu lugar.",
      footerLabel: "Mentor(a) parceiro(a) KLASSE",
    };
  }

  return {
    badge: "Inscrições Abertas",
    title: `Formação Profissional Certificada${localSuffix}`,
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

  const experience = resolveLandingExperience(data.escola.tenant_type, data.escola);
  const publicacao = data.publicacao ?? null;
  const locationText = data.escola.municipio ? ` em ${data.escola.municipio}, ${data.escola.provincia}` : "";

  const ogImage = `/api/formacao/publico/og?slug=${slug}`;

  return {
    title: data.seo?.title || `${data.escola.nome} · ${publicacao?.badge || experience.badge}${locationText}`,
    description: data.seo?.description || publicacao?.descricao || experience.description,
    keywords: data.seo?.keywords || `cursos, formação, ${data.escola.nome}, ${data.escola.municipio}, ${data.escola.provincia}`,
    openGraph: {
      title: data.seo?.title || data.escola.nome,
      description: data.seo?.description || publicacao?.descricao || experience.description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: data.escola.nome,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: data.seo?.title || data.escola.nome,
      description: data.seo?.description || publicacao?.descricao || experience.description,
      images: [ogImage],
    },
  };
}

export default async function PublicCentroLandingPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCentroData(slug);
  if (!data) notFound();

  const tenantType = data.escola.tenant_type;
  const experience = resolveLandingExperience(tenantType, data.escola);
  const publicacao = data.publicacao ?? null;
  const badge = publicacao?.badge || experience.badge;
  const headline = publicacao?.headline || experience.title;
  const description = publicacao?.descricao || experience.description;
  const faqItems = Array.isArray(publicacao?.faq)
    ? publicacao.faq.filter((item) => item?.pergunta && item?.resposta)
    : [];
  const contactItems = [
    { label: "WhatsApp", value: publicacao?.contactos?.whatsapp },
    { label: "Telefone", value: publicacao?.contactos?.telefone },
    { label: "E-mail", value: publicacao?.contactos?.email },
    { label: "Endereço", value: publicacao?.contactos?.endereco },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));
  const socialItems = [
    { label: "Instagram", href: publicacao?.redes_sociais?.instagram },
    { label: "Facebook", href: publicacao?.redes_sociais?.facebook },
    { label: "LinkedIn", href: publicacao?.redes_sociais?.linkedin },
    { label: "Website", href: publicacao?.redes_sociais?.website },
  ].filter((item): item is { label: string; href: string } => Boolean(item.href));

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

      <section
        className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-16 sm:py-24"
        style={
          publicacao?.banner_url
            ? {
                backgroundImage: `linear-gradient(rgba(2,6,23,0.82), rgba(2,6,23,0.96)), url(${publicacao.banner_url})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : undefined
        }
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative z-10 text-center">
            <div className="inline-flex rounded-full bg-klasse-gold/15 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-klasse-gold [font-family:var(--font-geist-mono)]">
              {badge}
            </div>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-6xl [font-family:var(--font-sora)]">
              {headline}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">{description}</p>
            {publicacao?.instrucoes ? (
              <p className="mx-auto mt-5 max-w-2xl rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-slate-300">
                {publicacao.instrucoes}
              </p>
            ) : null}
          </div>
        </div>
        <div className="absolute left-1/2 top-0 -z-10 h-[520px] w-[880px] -translate-x-1/2 rounded-full bg-klasse-gold/10 blur-[120px]" />
      </section>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <LandingContent
          tenantType={tenantType}
          centro={{
            id: data.escola.id,
            slug: data.escola.slug,
            nome: data.escola.nome,
            logo_url: data.escola.logo_url
          }}
          fiscal={data.fiscal}
          pagamento={data.pagamento ?? null}
          tracking={data.tracking}
          publicacao={data.publicacao ?? null}
          testemunhos={data.testemunhos}
          courses={data.courses}
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
            {(faqItems.length > 0
              ? faqItems
              : [
                  {
                    pergunta: "Como recebo o acesso ao curso?",
                    resposta:
                      "Após o envio do comprovativo, a nossa secretaria validará o pagamento em até 24h úteis. Receberá as credenciais de acesso por e-mail ou SMS.",
                  },
                  {
                    pergunta: "Os cursos têm suporte dos formadores?",
                    resposta:
                      "Sim, todos os nossos programas incluem canais de dúvida direto com os especialistas para garantir a sua aprendizagem.",
                  },
                  {
                    pergunta: "Posso solicitar fatura da minha inscrição?",
                    resposta:
                      "Com certeza. Basta solicitar à secretaria através do portal do aluno após a confirmação da sua matrícula.",
                  },
                ]).map((item) => (
              <div key={item.pergunta} className="py-6">
                <h4 className="text-lg font-bold text-white">{item.pergunta}</h4>
                <p className="mt-3 leading-relaxed text-slate-400">{item.resposta}</p>
              </div>
            ))}
          </div>
        </section>

        {contactItems.length > 0 || socialItems.length > 0 ? (
          <section className="mt-32 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <div className="grid gap-8 md:grid-cols-2">
              {contactItems.length > 0 ? (
                <div>
                  <h2 className="text-xl font-black text-white">Fale com a secretaria</h2>
                  <div className="mt-5 space-y-3">
                    {contactItems.map((item) => (
                      <p key={item.label} className="text-sm leading-6 text-slate-300">
                        <span className="font-bold text-klasse-gold">{item.label}:</span> {item.value}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              {socialItems.length > 0 ? (
                <div>
                  <h2 className="text-xl font-black text-white">Canais oficiais</h2>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {socialItems.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:border-klasse-gold/50 hover:text-klasse-gold"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
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
