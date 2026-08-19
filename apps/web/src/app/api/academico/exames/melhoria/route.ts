import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const requestSchema = z.object({
  exame_sessao_id: z.string().uuid(),
  matricula_id: z.string().uuid(),
  turma_disciplina_id: z.string().uuid(),
  nota_anterior: z.number().min(0).max(100),
  motivo: z.string().trim().min(5).max(2000),
});

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: ["professor", "secretaria", "admin", "admin_escola", "staff_admin", "diretor"] });
  if (authz.error) return authz.error;
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const body = parsed.data;

  const { data: session } = await supabase.from("exame_sessoes").select("id, tipo, estado").eq("id", body.exame_sessao_id).eq("escola_id", escolaId).maybeSingle();
  if (!session) return NextResponse.json({ ok: false, error: "Sessão de exame não encontrada." }, { status: 404 });
  if (session.tipo !== "recurso") return NextResponse.json({ ok: false, error: "A melhoria deve usar uma sessão de recurso.", code: "IMPROVEMENT_REQUIRES_RECURSO" }, { status: 409 });
  if (["encerrada", "cancelada"].includes(session.estado)) return NextResponse.json({ ok: false, error: "A sessão não aceita pedidos de melhoria.", code: "EXAM_SESSION_LOCKED" }, { status: 409 });

  const { data, error } = await supabase.from("melhoria_nota_pedidos").insert({ ...body, escola_id: escolaId, solicitado_por: auth.user.id }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
  return NextResponse.json({ ok: true, data, next_action: { type: "review", label: "Aguardar análise da secretaria" } }, { status: 201 });
}
