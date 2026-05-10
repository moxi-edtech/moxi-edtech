// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/pautas-status/route.ts
import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    // 1. Obter o ano ativo
    const { data: anoAtivo } = await supabase
      .from("anos_letivos")
      .select("id, ano")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .maybeSingle();

    if (!anoAtivo) return NextResponse.json({ ok: false, error: "Nenhum ano letivo ativo." });

    // 2. Contar Turmas Totais da Sessão Ativa
    const { data: turmas, error: turmasError } = await supabase
      .from("turmas")
      .select("id, nome")
      .eq("escola_id", escolaId)
      .eq("session_id", anoAtivo.id);

    if (turmasError) throw turmasError;

    const turmaIds = (turmas || []).map(t => t.id);

    const { data: periodos, error: periodosError } = await supabase
      .from("periodos_letivos")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", anoAtivo.id);

    if (periodosError) throw periodosError;

    const periodoIds = (periodos || []).map(periodo => periodo.id);

    // 3. Verificar Pautas Anuais Geradas no ano letivo ativo
    const { data: pautas, error: pautasError } = await supabase
      .from("pautas_oficiais")
      .select("turma_id")
      .eq("escola_id", escolaId)
      .eq("status", "SUCCESS")
      .eq("tipo", "anual")
      .in("turma_id", turmaIds.length > 0 ? turmaIds : [crypto.randomUUID()])
      .in("periodo_letivo_id", periodoIds.length > 0 ? periodoIds : [crypto.randomUUID()]);

    if (pautasError) throw pautasError;

    const geradasSet = new Set(pautas?.map(p => p.turma_id));
    const pendentes = (turmas || []).filter(t => !geradasSet.has(t.id));

    // 4. Verificar se há algum Job de Lote ativo
    const { data: activeJob } = await supabase
      .from("pautas_lote_jobs")
      .select("*")
      .eq("escola_id", escolaId)
      .eq("status", "PROCESSING")
      .eq("documento_tipo", "pauta_anual")
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      stats: {
        total: turmas?.length || 0,
        geradas: geradasSet.size,
        pendentes_count: pendentes.length,
        pendentes_list: pendentes.map(t => t.nome)
      },
      active_job: activeJob || null,
      ano_ativo: anoAtivo
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
