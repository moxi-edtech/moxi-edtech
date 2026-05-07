// apps/web/src/app/api/public/admissoes/[escolaSlug]/configuracao/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ escolaSlug: string }> }
) {
  try {
    const { escolaSlug } = await params;
    const supabase = supabaseServerRole();

    // 1. Resolve school
    const { escolaId, slug } = await resolveEscolaParam(supabase as any, escolaSlug);

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 404 });
    }

    // 2. Fetch public config and data in parallel
    const [escolaRes, anosRes, cursosRes, turmasRes] = await Promise.all([
      supabase
        .from("escolas")
        .select("id, nome, logo_url, cor_primaria, status")
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
      return NextResponse.json({ ok: false, error: "Erro ao carregar dados da escola" }, { status: 500 });
    }

    if (escolaRes.data.status !== "ativa") {
      return NextResponse.json({ ok: false, error: "Escola não está aceitando novas inscrições no momento" }, { status: 403 });
    }

    const activeAno = Number(anosRes.data?.ano);
    const turmasAtivas = (turmasRes.data || []).filter((turma) => {
      if (!Number.isFinite(activeAno)) return true;
      return Number(turma.ano_letivo) === activeAno;
    });

    return NextResponse.json({
      ok: true,
      config: {
        escola: {
          id: escolaRes.data.id,
          nome: escolaRes.data.nome,
          logo_url: escolaRes.data.logo_url,
          cor_primaria: escolaRes.data.cor_primaria,
          slug: slug,
        },
        ano_letivo: anosRes.data || null,
        cursos: cursosRes.data || [],
        turmas: turmasAtivas.map(t => ({
          id: t.id,
          nome: t.nome,
          turno: t.turno,
          curso_id: t.curso_id,
        })),
      },
    });
  } catch (err) {
    console.error("[Public Config Error]:", err);
    return NextResponse.json({ ok: false, error: "Erro interno ao processar requisição" }, { status: 500 });
  }
}
