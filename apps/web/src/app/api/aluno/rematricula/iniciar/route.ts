import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveOpenRematriculaWindow } from "@/lib/secretaria/rematricula-window";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.alunoId || !ctx.anoLetivo) {
      return NextResponse.json({ ok: false, error: "A escola ainda está a concluir a sua situação académica.", code: "ACADEMIC_PROMOTION_PENDING" }, { status: 409 });
    }

    if (!ctx?.escolaId || !ctx.alunoId) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const openWindow = await resolveOpenRematriculaWindow(supabase, ctx.escolaId, Number(ctx.anoLetivo));
    if (!openWindow) {
      return NextResponse.json({ ok: false, error: "A janela de rematrícula ainda não está aberta.", code: "REMATRICULA_WINDOW_CLOSED" }, { status: 409 });
    }

    // A virada em lote pode já ter criado uma matrícula no ano destino.
    // A origem da reconfirmação continua a ser sempre o último ano anterior.
    const { data: matricula, error: matriculaError } = await (supabase as any)
      .from("matriculas")
      .select("id, ano_letivo")
      .eq("escola_id", ctx.escolaId)
      .eq("aluno_id", ctx.alunoId)
      .lt("ano_letivo", openWindow.ano_letivo)
      .in("status", ["ativo", "ativa", "active", "transferido"])
      .order("ano_letivo", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (matriculaError || !matricula?.id) {
      return NextResponse.json({ ok: false, error: "Não foi encontrada uma matrícula de origem para iniciar a rematrícula. Contacte a secretaria.", code: "REMATRICULA_SOURCE_INVALID" }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const servicosIds = Array.isArray(body?.servicos_ids)
      ? body.servicos_ids.filter((value: unknown): value is string => typeof value === "string")
      : [];

    const { data, error } = await (supabase as any).rpc("aluno_iniciar_rematricula", {
      p_matricula_id: matricula.id,
      p_servicos_ids: servicosIds,
    });

    if (error) {
      const message = error.message || "Não foi possível iniciar a rematrícula.";
      const status = message.includes("FINANCEIRO:") ? 403 : message.includes("AUTH:") ? 403 : 409;
      return NextResponse.json({ ok: false, error: message.replace(/^(DATA|FINANCEIRO|AUTH):\s*/, "") }, { status });
    }

    return NextResponse.json(data ?? { ok: false, error: "Resposta inválida ao iniciar rematrícula." });
  } catch (error) {
    console.error("[aluno/rematricula/iniciar]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível iniciar a rematrícula." }, { status: 500 });
  }
}
