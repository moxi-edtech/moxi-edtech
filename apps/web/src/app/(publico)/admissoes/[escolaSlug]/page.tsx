// apps/web/src/app/(publico)/admissoes/[escolaSlug]/page.tsx
import { notFound } from "next/navigation";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { PublicHeader } from "./components/PublicHeader";
import { AdmissionForm, type AdmissionConfig } from "./AdmissionForm";
import { Metadata } from "next";
import type { Json } from "~types/supabase";

export const dynamic = "force-dynamic";

type DisponibilidadePublica = "disponivel" | "ultimas_vagas" | "lista_espera";
type ConfigPortal = NonNullable<AdmissionConfig["escola"]["config_portal"]>;
type CampoExtra = NonNullable<ConfigPortal["campos_extras"]>[number];

interface PageProps {
  params: Promise<{ escolaSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { escolaSlug } = await params;
  const supabase = supabaseServerRole();
  const { escolaId } = await resolveEscolaParam(supabase, escolaSlug);

  if (!escolaId) return { title: "Escola não encontrada" };

  const { data: escola } = await supabase
    .from("escolas")
    .select("nome")
    .eq("id", escolaId)
    .maybeSingle();

  return {
    title: `Admissão Online - ${escola?.nome || "Klasse"}`,
    description: `Portal de candidatura online para ${escola?.nome || "nossa escola"}.`,
  };
}

function disponibilidadePublica(capacidade: number | null, matriculadosAtivos: number): DisponibilidadePublica {
  if (capacidade === null) return "disponivel";
  const vagas = capacidade - matriculadosAtivos;
  if (vagas <= 0) return "lista_espera";
  if (vagas <= 5) return "ultimas_vagas";
  return "disponivel";
}

function isRecord(value: Json | undefined): value is Record<string, Json> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseConfigPortal(value: Json | undefined): ConfigPortal | null {
  if (!isRecord(value)) return null;

  const whatsapp = value.whatsapp_suporte;
  const documentos = value.documentos_obrigatorios;
  const campos = value.campos_extras;

  const camposExtras: CampoExtra[] | undefined = Array.isArray(campos)
    ? campos
        .filter((campo): campo is Record<string, Json> => isRecord(campo))
        .map((campo): CampoExtra => {
          const tipo: CampoExtra["tipo"] =
            campo.tipo === "select" || campo.tipo === "number" || campo.tipo === "text"
              ? campo.tipo
              : "text";

          return {
            id: typeof campo.id === "string" ? campo.id : "",
            label: typeof campo.label === "string" ? campo.label : "",
            tipo,
            required: campo.required === true,
            options: Array.isArray(campo.options)
              ? campo.options.filter((item): item is string => typeof item === "string")
              : undefined,
          };
        })
        .filter((campo) => campo.id && campo.label)
    : undefined;

  return {
    whatsapp_suporte: typeof whatsapp === "string" ? whatsapp : undefined,
    documentos_obrigatorios: Array.isArray(documentos)
      ? documentos.filter((item): item is string => typeof item === "string")
      : undefined,
    campos_extras: camposExtras,
  };
}

export default async function PublicAdmissionPage({ params }: PageProps) {
  const { escolaSlug } = await params;
  const supabase = supabaseServerRole();

  // 1. Resolve school
  const { escolaId, slug } = await resolveEscolaParam(supabase, escolaSlug);

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
      .select("id, nome, turno, curso_id, capacidade_maxima, status_validacao, ano_letivo")
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

  const activeAno = Number(anosRes.data?.ano);
  const turmasAtivas = (turmasRes.data || []).filter((turma) => {
    if (!Number.isFinite(activeAno)) return true;
    return Number(turma.ano_letivo) === activeAno;
  });
  const turmaIds = turmasAtivas.map((turma) => turma.id);
  const ocupacaoPorTurma = new Map<string, number>();

  if (turmaIds.length > 0) {
    const ocupacoes = await Promise.all(
      turmaIds.map(async (turmaId) => {
        const { data, error } = await supabase.rpc("admissao_turma_ocupacao_reservada", {
          p_escola_id: escolaId,
          p_turma_id: turmaId,
        });
        if (error) throw error;
        return [turmaId, data ?? 0] as const;
      })
    );

    for (const [turmaId, ocupacao] of ocupacoes) ocupacaoPorTurma.set(turmaId, ocupacao);
  }

  const config: AdmissionConfig = {
    escola: {
      id: escolaRes.data.id,
      nome: escolaRes.data.nome,
      logo_url: escolaRes.data.logo_url,
      cor_primaria: escolaRes.data.cor_primaria,
      slug: slug || escolaSlug,
      config_portal: parseConfigPortal(escolaRes.data.config_portal_admissao) ?? undefined,
    },
    ano_letivo: anosRes.data || null,
    cursos: cursosRes.data || [],
    turmas: turmasAtivas.flatMap((t) => {
      if (!t.curso_id) return [];
      return [{
        id: t.id,
        nome: t.nome,
        turno: t.turno || "",
        curso_id: t.curso_id,
        disponibilidade: disponibilidadePublica(t.capacidade_maxima, ocupacaoPorTurma.get(t.id) || 0),
      }];
    }),
  };

  if (!config.ano_letivo || config.cursos.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-8">
        <div className="h-20 w-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Portal em Configuração</h1>
        <p className="mt-2 text-slate-500 max-w-md">
          Esta escola ainda está configurando o catálogo de cursos para o próximo ano letivo. 
          Por favor, tente novamente em breve ou contacte a secretaria.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader config={config} />
      <main className="pb-16">
        <AdmissionForm config={config} />
      </main>
    </div>
  );
}
