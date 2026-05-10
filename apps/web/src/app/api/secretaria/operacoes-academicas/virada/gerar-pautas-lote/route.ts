// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/gerar-pautas-lote/route.ts
import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { inngest } from "@/inngest/client";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

    // 2. Obter todas as turmas da sessão
    const { data: turmas } = await supabase
      .from("turmas")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("session_id", anoAtivo.id);

    if (!turmas || turmas.length === 0) {
      return NextResponse.json({ ok: false, error: "Nenhuma turma encontrada nesta sessão." });
    }

    const { data: periodoFinal, error: periodoFinalError } = await supabase
      .from("periodos_letivos")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", anoAtivo.id)
      .order("data_fim", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (periodoFinalError) throw periodoFinalError;
    if (!periodoFinal?.id) {
      return NextResponse.json({
        ok: false,
        error: "Ano letivo ativo sem período final configurado para pauta anual.",
      }, { status: 409 });
    }

    const turmaIds = turmas.map(t => t.id);

    // 3. Criar Job de Lote (Pauta Anual)
    // Usamos a lógica atômica do sistema de documentos oficiais
    const documentoTipo = "pauta_anual";
    const idempotencyKey = `virada_wizard:pautas_anual:${anoAtivo.id}`;

    // Verifica se já existe
    const { data: existing } = await supabase
      .from("pautas_lote_jobs")
      .select("id, status")
      .eq("escola_id", escolaId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing?.status === "PROCESSING") {
      return NextResponse.json({ ok: true, job_id: existing.id, status: "ALREADY_PROCESSING" });
    }

    const { data: job, error: jobError } = await supabase
      .from("pautas_lote_jobs")
      .insert({
        escola_id: escolaId,
        created_by: user.id,
        tipo: "anual",
        documento_tipo: documentoTipo,
        periodo_letivo_id: periodoFinal.id,
        status: "PROCESSING",
        total_turmas: turmaIds.length,
        processed: 0,
        success_count: 0,
        failed_count: 0,
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();

    if (jobError) throw jobError;

    // 4. Inserir Itens do Lote
    const itens = turmaIds.map(id => ({ job_id: job.id, turma_id: id, status: "QUEUED" }));
    await supabase.from("pautas_lote_itens").insert(itens);

    // 5. Disparar Evento Inngest
    await inngest.send({
      name: "docs/pautas-lote.requested",
      data: {
        job_id: job.id,
        escola_id: escolaId,
        turma_ids: turmaIds,
        tipo: "anual",
        documento_tipo: documentoTipo,
        periodo_letivo_id: periodoFinal.id
      },
    });

    return NextResponse.json({ ok: true, job_id: job.id, status: "STARTED" });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
