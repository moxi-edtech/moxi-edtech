import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GradeSchema = z.object({ nota: z.number().min(0).max(100), feedback: z.string().trim().max(5000).nullable().optional() });

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; entregaId: string }> }) {
  const { id, entregaId } = await context.params;
  const supabase = await supabaseServerTyped<any>();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const parsed = GradeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ ok: false, error: "Nota ou feedback inválido" }, { status: 400 });

  const { data: activity } = await supabase.from("atividades_pedagogicas").select("id, nota_maxima").eq("id", id).eq("escola_id", escolaId).eq("created_by", user.id).maybeSingle();
  if (!activity) return noStore({ ok: false, error: "Actividade não encontrada", next_action: { type: "return_to_activities", label: "Voltar às actividades", href: "/professor/atividades" } }, { status: 404 });
  if (parsed.data.nota > Number(activity.nota_maxima)) return noStore({ ok: false, error: `A nota não pode exceder ${activity.nota_maxima} pontos` }, { status: 400 });

  const { data: entrega, error } = await supabase.from("atividade_entregas")
    .update({ nota: parsed.data.nota, feedback: parsed.data.feedback ?? null, estado: "corrigida", graded_at: new Date().toISOString(), graded_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", entregaId).eq("escola_id", escolaId).eq("atividade_id", id)
    .select("id, atividade_id, aluno_id, estado, nota, feedback, graded_at, updated_at").maybeSingle();
  if (error) return noStore({ ok: false, error: error.message }, { status: 400 });
  if (!entrega) return noStore({ ok: false, error: "Entrega não encontrada" }, { status: 404 });
  return noStore({ ok: true, entrega });
}
