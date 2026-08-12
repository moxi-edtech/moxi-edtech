import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const RequestSchema = z.object({ fonte_ids: z.array(z.string().uuid()).min(1).max(10), parametros: z.record(z.string(), z.unknown()).default({}) });
const noStore = (body: unknown, init?: ResponseInit) => { const r = NextResponse.json(body, init); r.headers.set("Cache-Control", "no-store, max-age=0"); return r; };

async function ctx() {
  const supabase = await supabaseServerTyped<any>();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { supabase, user: null, escolaId: null };
  return { supabase, user, escolaId: await resolveEscolaIdForUser(supabase, user.id) };
}

export async function GET() {
  const { supabase, user, escolaId } = await ctx();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: ["professor", "admin", "admin_escola", "diretor"] });
  if (authz.error) return authz.error;
  const { data, error } = await supabase.from("pedagogical_ai_requests").select("id, fonte_ids, parametros, status, resultado_rascunho, erro, created_at, updated_at").eq("escola_id", escolaId).eq("created_by", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return noStore({ ok: false, error: error.message }, { status: 500 });
  return noStore({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, escolaId } = await ctx();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: ["professor", "admin", "admin_escola", "diretor"] });
  if (authz.error) return authz.error;
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ ok: false, error: "Seleccione pelo menos uma fonte pedagógica" }, { status: 400 });
  const { count } = await supabase.from("fontes_pedagogicas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).eq("status", "publicada").in("id", parsed.data.fonte_ids);
  if (count !== parsed.data.fonte_ids.length) return noStore({ ok: false, error: "Uma fonte não está publicada ou não pertence à escola", next_action: { type: "select_sources", label: "Escolher fontes", href: "/professor/materiais" } }, { status: 409 });
  const { data, error } = await supabase.from("pedagogical_ai_requests").insert({ escola_id: escolaId, created_by: user.id, fonte_ids: parsed.data.fonte_ids, parametros: parsed.data.parametros, status: "aguarda_revisao" }).select("id, status, fonte_ids, parametros, created_at").single();
  if (error) return noStore({ ok: false, error: error.message }, { status: 400 });
  return noStore({ ok: true, item: data, message: "Pedido registado como rascunho pendente de geração e revisão humana." }, { status: 201 });
}
