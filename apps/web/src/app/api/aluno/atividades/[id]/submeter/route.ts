import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAlunoContext } from "@/lib/alunoContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SubmissionSchema = z.object({
  tentativa: z.number().int().min(1).max(10),
  respostas: z.record(z.string(), z.unknown()),
  finalizar: z.boolean().default(true),
});

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: atividadeId } = await context.params;
  const { supabase, ctx } = await getAlunoContext();
  if (!ctx) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!ctx.escolaId || !ctx.alunoId || !ctx.turmaId) {
    return noStore({ ok: false, error: "Aluno sem matrícula activa" }, { status: 403 });
  }

  const parsed = SubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ ok: false, error: "Entrega inválida" }, { status: 400 });

  const { data: activity, error: activityError } = await (supabase as any)
    .from("atividades_pedagogicas")
    .select("id, turma_id, status, prazo, tentativas_permitidas")
    .eq("id", atividadeId)
    .eq("escola_id", ctx.escolaId)
    .eq("turma_id", ctx.turmaId)
    .maybeSingle();
  if (activityError) return noStore({ ok: false, error: activityError.message }, { status: 500 });
  if (!activity || activity.status !== "publicada") {
    return noStore({ ok: false, error: "Actividade indisponível" }, { status: 404 });
  }
  if (parsed.data.finalizar && activity.prazo && new Date(activity.prazo).getTime() < Date.now()) {
    return noStore({
      ok: false,
      error: "O prazo desta actividade terminou",
      next_action: { type: "contact_teacher", label: "Contactar professor", href: "/aluno/avisos" },
    }, { status: 409 });
  }
  if (parsed.data.tentativa > activity.tentativas_permitidas) {
    return noStore({ ok: false, error: "Número máximo de tentativas atingido" }, { status: 409 });
  }

  const { data: existing } = await (supabase as any)
    .from("atividade_entregas")
    .select("id, estado")
    .eq("escola_id", ctx.escolaId)
    .eq("atividade_id", atividadeId)
    .eq("aluno_id", ctx.alunoId)
    .eq("tentativa", parsed.data.tentativa)
    .maybeSingle();
  if (existing?.estado === "submetida" || existing?.estado === "corrigida") {
    return noStore({ ok: false, error: "Esta tentativa já foi submetida" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from("atividade_entregas")
    .upsert({
      id: existing?.id,
      escola_id: ctx.escolaId,
      atividade_id: atividadeId,
      aluno_id: ctx.alunoId,
      tentativa: parsed.data.tentativa,
      estado: parsed.data.finalizar ? "submetida" : "iniciada",
      respostas: parsed.data.respostas,
      submitted_at: parsed.data.finalizar ? now : null,
      updated_at: now,
    }, { onConflict: "atividade_id,aluno_id,tentativa" })
    .select("id, atividade_id, tentativa, estado, submitted_at, updated_at")
    .single();
  if (error) return noStore({ ok: false, error: error.message }, { status: 400 });
  return noStore({
    ok: true,
    entrega: data,
    next_action: parsed.data.finalizar
      ? { type: "view_result", label: "Acompanhar correcção", href: "/aluno/academico" }
      : { type: "resume_submission", label: "Retomar actividade", href: `/aluno/atividades/${atividadeId}` },
  }, { status: 201 });
}
