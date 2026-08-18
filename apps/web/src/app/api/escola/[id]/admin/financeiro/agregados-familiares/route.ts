import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  agregado_id: z.string().uuid().optional(),
  aluno_id: z.string().uuid().optional(),
  nome: z.string().trim().min(2).max(160).optional(),
  telefone: z.string().trim().max(40).optional().nullable(),
});

async function context(requestedId: string) {
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, escolaId: null, error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id, requestedId);
  if (!escolaId) return { supabase, escolaId: null, error: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  const { data: role } = await supabase.rpc("user_has_role_in_school", { p_escola_id: escolaId, p_roles: ["admin_escola", "admin", "secretaria", "financeiro", "admin_financeiro", "staff_admin"] });
  if (!role) return { supabase, escolaId: null, error: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  return { supabase, escolaId, error: null };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, escolaId, error } = await context(id);
  if (error || !escolaId) return error;
  const [{ data: agregados, error: groupError }, { data: alunos, error: studentError }] = await Promise.all([
    (supabase as any).from("financeiro_agregados_familiares").select("id, nome, telefone, financeiro_agregados_membros(aluno_id, alunos(id, nome, nome_completo))").eq("escola_id", escolaId).order("nome"),
    supabase.from("alunos").select("id, nome, nome_completo, encarregado_nome, encarregado_telefone").eq("escola_id", escolaId).is("deleted_at", null).order("nome"),
  ]);
  if (groupError || studentError) return NextResponse.json({ ok: false, error: groupError?.message || studentError?.message }, { status: 500 });
  return NextResponse.json({ ok: true, agregados: agregados ?? [], alunos: alunos ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, escolaId, error } = await context(id);
  if (error || !escolaId) return error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.aluno_id) return NextResponse.json({ ok: false, error: "Aluno obrigatório." }, { status: 400 });
  let agregadoId = parsed.data.agregado_id;
  if (!agregadoId) {
    if (!parsed.data.nome) return NextResponse.json({ ok: false, error: "Nome do agregado obrigatório." }, { status: 400 });
    const { data, error: insertError } = await (supabase as any).from("financeiro_agregados_familiares").insert({ escola_id: escolaId, nome: parsed.data.nome, telefone: parsed.data.telefone || null }).select("id").single();
    if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
    agregadoId = data.id;
  }
  const { error: memberError } = await (supabase as any).from("financeiro_agregados_membros").insert({ agregado_id: agregadoId, aluno_id: parsed.data.aluno_id });
  if (memberError) return NextResponse.json({ ok: false, error: memberError.code === "23505" ? "Este aluno já pertence a um agregado familiar." : memberError.message }, { status: 400 });
  const { data: year } = await supabase.from("anos_letivos").select("id").eq("escola_id", escolaId).eq("ativo", true).maybeSingle();
  let aplicacao = null;
  if (year) {
    const { data, error: applyError } = await (supabase as any).rpc("aplicar_desconto_familiar", { p_escola_id: escolaId, p_ano_letivo_id: year.id });
    if (applyError) return NextResponse.json({ ok: false, error: `Aluno associado, mas o desconto não foi recalculado: ${applyError.message}`, agregado_id: agregadoId }, { status: 500 });
    aplicacao = data;
  }
  return NextResponse.json({ ok: true, agregado_id: agregadoId, aplicacao });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, escolaId, error } = await context(id);
  if (error || !escolaId) return error;
  const parsed = z.object({ agregado_id: z.string().uuid(), aluno_id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Agregado e aluno são obrigatórios." }, { status: 400 });
  const { error: removeError } = await (supabase as any)
    .from("financeiro_agregados_membros")
    .delete()
    .eq("agregado_id", parsed.data.agregado_id)
    .eq("aluno_id", parsed.data.aluno_id);
  if (removeError) return NextResponse.json({ ok: false, error: removeError.message }, { status: 400 });
  const { data: year } = await supabase.from("anos_letivos").select("id").eq("escola_id", escolaId).eq("ativo", true).maybeSingle();
  let aplicacao = null;
  if (year) {
    const { data, error: applyError } = await (supabase as any).rpc("aplicar_desconto_familiar", { p_escola_id: escolaId, p_ano_letivo_id: year.id });
    if (applyError) return NextResponse.json({ ok: false, error: `Aluno removido, mas o desconto não foi recalculado: ${applyError.message}` }, { status: 500 });
    aplicacao = data;
  }
  return NextResponse.json({ ok: true, aplicacao });
}
