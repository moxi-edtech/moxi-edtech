import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const Body = z.object({ aluno_id: z.string().uuid(), turma_id: z.string().uuid(), tipo: z.enum(["enviar_alerta", "atribuir_ficha", "contactar_familia", "acompanhar_aluno"]), insight_id: z.string().uuid().nullable().optional(), motivo: z.string().trim().max(2000).nullable().optional(), payload: z.record(z.string(), z.unknown()).default({}) });
const noStore = (body: unknown, init?: ResponseInit) => { const r = NextResponse.json(body, init); r.headers.set("Cache-Control", "no-store, max-age=0"); return r; };

async function ctx() { const supabase = await supabaseServerTyped<any>(); const { data } = await supabase.auth.getUser(); const user = data.user; return { supabase, user, escolaId: user ? await resolveEscolaIdForUser(supabase, user.id) : null }; }

export async function GET() {
  const { supabase, user, escolaId } = await ctx();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: ["professor", "admin", "admin_escola", "secretaria", "diretor"] });
  if (authz.error) return authz.error;
  const { data, error } = await supabase.from("intervencoes_pedagogicas").select("id, aluno_id, turma_id, tipo, status, motivo, payload, due_at, completed_at, created_at, alunos:alunos(id,nome,nome_completo), turmas:turmas(id,nome)").eq("escola_id", escolaId).or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`).order("created_at", { ascending: false }).limit(50);
  if (error) return noStore({ ok: false, error: error.message }, { status: 500 });
  return noStore({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, escolaId } = await ctx();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: ["professor", "admin", "admin_escola", "secretaria", "diretor"] });
  if (authz.error) return authz.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ ok: false, error: "Dados da intervenção inválidos" }, { status: 400 });
  const { data, error } = await supabase.from("intervencoes_pedagogicas").insert({ escola_id: escolaId, created_by: user.id, ...parsed.data }).select("id, aluno_id, turma_id, tipo, status, motivo, payload, created_at").single();
  if (error) return noStore({ ok: false, error: error.message }, { status: 400 });
  return noStore({ ok: true, item: data, next_action: { type: "track_intervention", label: "Acompanhar intervenção", href: "/professor/intervencoes" } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, user, escolaId } = await ctx();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(["em_tratamento", "concluida", "cancelada"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ ok: false, error: "Estado da intervenção inválido" }, { status: 400 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: ["professor", "admin", "admin_escola", "secretaria", "diretor"] });
  if (authz.error) return authz.error;
  const { data, error } = await supabase.from("intervencoes_pedagogicas").update({ status: parsed.data.status, completed_at: parsed.data.status === "concluida" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("escola_id", escolaId).or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`).select("id, status, completed_at, updated_at").maybeSingle();
  if (error) return noStore({ ok: false, error: error.message }, { status: 400 });
  if (!data) return noStore({ ok: false, error: "Intervenção não encontrada", next_action: { type: "reload_queue", label: "Actualizar fila", href: "/professor/intervencoes" } }, { status: 404 });
  return noStore({ ok: true, item: data, next_action: { type: "reload_queue", label: "Voltar à fila", href: "/professor/intervencoes" } });
}
