// apps/web/src/app/api/public/admissoes/[escolaSlug]/configuracao/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { getAnoLetivoAdmissoesFromConfig } from "@/lib/admissoes/reserva";
import { formatAnoLetivoDisplay } from "@/utils/formatters";

export const dynamic = "force-dynamic";

type DisponibilidadePublica = "disponivel" | "ultimas_vagas" | "lista_espera";

function disponibilidadePublica(capacidade: number | null, matriculadosAtivos: number): DisponibilidadePublica {
  if (capacidade === null) return "disponivel";
  const vagas = capacidade - matriculadosAtivos;
  if (vagas <= 0) return "lista_espera";
  if (vagas <= 5) return "ultimas_vagas";
  return "disponivel";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ escolaSlug: string }> }
) {
  try {
    const { escolaSlug } = await params;
    const supabase = supabaseServerRole();

    // 1. Resolve school
    const { escolaId, slug } = await resolveEscolaParam(supabase, escolaSlug);

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 404 });
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
        .select("id, ano, ativo, data_inicio, data_fim")
        .eq("escola_id", escolaId)
        .order("ano", { ascending: false }) // Pegar o ano mais recente (ex: 2025)
        .limit(20),
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

    const anosLetivos = Array.isArray(anosRes.data) ? anosRes.data : [];
    const latestAno = Number(anosLetivos[0]?.ano);
    const configuredAno = getAnoLetivoAdmissoesFromConfig(
      escolaRes.data.config_portal_admissao,
      latestAno
    );
    const activeAno = Number(configuredAno);
    const selectedAnoLetivo = anosLetivos.find((ano) => Number(ano.ano) === activeAno) ?? anosLetivos[0] ?? null;
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
        ano_letivo: selectedAnoLetivo
          ? { ...selectedAnoLetivo, label: formatAnoLetivoDisplay(selectedAnoLetivo) }
          : null,
        cursos: cursosRes.data || [],
        turmas: turmasAtivas.map(t => ({
          id: t.id,
          nome: t.nome,
          turno: t.turno,
          curso_id: t.curso_id,
          disponibilidade: disponibilidadePublica(
            t.capacidade_maxima,
            ocupacaoPorTurma.get(t.id) || 0
          ),
        })),
      },
    });
  } catch (err) {
    console.error("[Public Config Error]:", err);
    return NextResponse.json({ ok: false, error: "Erro interno ao processar requisição" }, { status: 500 });
  }
}
