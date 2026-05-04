// apps/web/src/app/(publico)/admissoes/[escolaSlug]/page.tsx
import { notFound } from "next/navigation";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { AdmissionForm } from "./AdmissionForm";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ escolaSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { escolaSlug } = await params;
  const supabase = supabaseServerRole();
  const { escolaId } = await resolveEscolaParam(supabase as any, escolaSlug);

  if (!escolaId) return { title: "Escola não encontrada" };

  const { data: escola } = await supabase
    .from("escolas")
    .select("nome")
    .eq("id", escolaId)
    .maybeSingle();

  return {
    title: `Admissão Online - ${escola?.nome || "Klasse"}`,
    description: `Portal de inscrição e reserva de vaga para ${escola?.nome || "nossa escola"}.`,
  };
}

export default async function PublicAdmissionPage({ params }: PageProps) {
  const { escolaSlug } = await params;
  const supabase = supabaseServerRole();

  // 1. Resolve school
  const { escolaId, slug } = await resolveEscolaParam(supabase as any, escolaSlug);

  if (!escolaId) {
    return notFound();
  }

  // 2. Fetch public config and data in parallel
  const [escolaRes, anosRes, cursosRes, turmasRes] = await Promise.all([
    supabase
      .from("escolas")
      .select("id, nome, logo_url, cor_primaria, status, config_portal_admissao")
      .eq("id", escolaId)
      .maybeSingle(),
    supabase
      .from("anos_letivos")
      .select("id, ano, ativo")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .maybeSingle(),
    supabase
      .from("cursos")
      .select("id, nome")
      .eq("escola_id", escolaId)
      .order("nome", { ascending: true }),
    supabase
      .from("turmas")
      .select("id, nome, turno, curso_id, status_validacao")
      .eq("escola_id", escolaId)
      .eq("status_validacao", "ativo"),
  ]);

  if (escolaRes.error || !escolaRes.data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-black text-slate-900">Erro ao carregar dados</h1>
        <p className="mt-2 text-slate-500">Não foi possível recuperar as informações da escola.</p>
      </div>
    );
  }

  if (escolaRes.data.status !== "ativa") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-8">
        <div className="h-20 w-20 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Inscrições Indisponíveis</h1>
        <p className="mt-2 text-slate-500 max-w-md">Esta escola não está aceitando novas inscrições online no momento. Por favor, entre em contato diretamente com a secretaria.</p>
      </div>
    );
  }

  const config = {
    escola: {
      id: escolaRes.data.id,
      nome: escolaRes.data.nome,
      logo_url: escolaRes.data.logo_url,
      cor_primaria: escolaRes.data.cor_primaria,
      slug: slug || escolaSlug,
      config_portal: (escolaRes.data.config_portal_admissao as any) || null,
    },
    ano_letivo: anosRes.data || null,
    cursos: cursosRes.data || [],
    turmas: (turmasRes.data || []).map(t => ({
      id: t.id,
      nome: t.nome,
      turno: t.turno,
      curso_id: t.curso_id,
    })),
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 md:py-20">
      <AdmissionForm config={config as any} />
    </main>
  );
}
