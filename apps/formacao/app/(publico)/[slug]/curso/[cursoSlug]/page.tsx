import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Geist_Mono, Sora } from "next/font/google";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string; cursoSlug: string }>;
};

async function getCourseData(centroSlug: string, cursoSlug: string) {
  const supabaseUrl = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = String(
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ).trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // We reuse the landing data but we could have a specific RPC for course detail
  // For now, let's just find the course in the landing payload
  const { data, error } = await supabase.rpc("get_public_landing_data", { p_slug: centroSlug });
  if (error || !data) return null;

  const courses = (data as any).courses || [];
  const course = courses.find((c: any) => c.slug === cursoSlug);
  
  return course ? { escola: (data as any).escola, course } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, cursoSlug } = await params;
  const data = await getCourseData(slug, cursoSlug);
  if (!data) return { title: "Curso não encontrado" };

  const { course, escola } = data;
  const seo = course.seo_config || {};

  return {
    title: seo.title || `${course.nome} · ${escola.nome}`,
    description: seo.description || `Inscreva-se no curso de ${course.nome} em ${escola.nome}.`,
    openGraph: {
      title: seo.title || course.nome,
      images: course.thumbnail_url ? [{ url: course.thumbnail_url }] : [],
    }
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug, cursoSlug } = await params;
  const data = await getCourseData(slug, cursoSlug);
  if (!data) notFound();

  const { course, escola } = data;

  return (
    <div className={`${sora.variable} ${geistMono.variable} min-h-screen bg-slate-950 text-slate-100`}>
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href={`/${slug}`} className="flex items-center gap-3">
            {escola.logo_url ? (
              <Image src={escola.logo_url} alt={escola.nome} width={32} height={32} className="rounded-lg" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-klasse-gold font-black text-slate-950">
                {escola.nome.charAt(0)}
              </div>
            )}
            <span className="text-sm font-black tracking-tight">{escola.nome}</span>
          </Link>
          <Link href={`/${slug}`} className="text-xs font-bold text-slate-400 hover:text-white">
            ← Voltar para a Landing
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_350px]">
          <section>
            <h1 className="text-4xl font-black text-white sm:text-5xl">{course.nome}</h1>
            <p className="mt-4 text-lg text-slate-400">{course.area || "Geral"}</p>
            
            <div className="mt-8 aspect-video w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              {course.video_url ? (
                <iframe
                  src={course.video_url.replace("watch?v=", "embed/")}
                  className="h-full w-full"
                  allowFullScreen
                />
              ) : course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={course.nome} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-600">Sem média disponível</div>
              )}
            </div>

            <div className="mt-12 space-y-10">
              {course.objetivos?.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-white">O que vais aprender</h2>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {course.objetivos.map((obj: string, i: number) => (
                      <li key={i} className="flex gap-3 text-sm text-slate-300">
                        <span className="text-emerald-500">✓</span> {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {course.requisitos?.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-white">Requisitos</h2>
                  <ul className="mt-4 space-y-2">
                    {course.requisitos.map((req: string, i: number) => (
                      <li key={i} className="flex gap-3 text-sm text-slate-400">
                        <span className="text-slate-600">•</span> {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="sticky top-24 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Investimento</p>
              <p className="mt-2 text-3xl font-black text-klasse-gold">
                {course.open_cohorts?.[0] ? new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(course.open_cohorts[0].valor_referencia) : "Sob consulta"}
              </p>
              
              <div className="mt-6 space-y-3">
                <p className="text-xs font-medium text-slate-400">Modalidade: <span className="text-white uppercase">{course.modalidade}</span></p>
                <p className="text-xs font-medium text-slate-400">Carga Horária: <span className="text-white">{course.carga_horaria}h</span></p>
              </div>

              <Link 
                href={`/${slug}`}
                className="mt-8 block w-full rounded-xl bg-white py-4 text-center text-sm font-black text-slate-950 hover:bg-klasse-gold transition-colors"
              >
                VER TURMAS E INSCREVER
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
