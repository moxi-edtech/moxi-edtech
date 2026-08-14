import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const ROLES = ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin_secretaria", "admin", "admin_escola", "staff_admin", "diretor"] as const;
const Month = z.string().regex(/^\d{4}-\d{2}$/);

async function context() {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return { supabase, error: NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 }) };
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...ROLES] });
  if (authz.error) return { supabase, error: authz.error };
  return { supabase, auth, escolaId };
}

export async function GET(req: Request) {
  const ctx = await context();
  if (ctx.error || !ctx.auth || !ctx.escolaId) return ctx.error;
  const month = Month.safeParse(new URL(req.url).searchParams.get("month"));
  if (!month.success) return NextResponse.json({ ok: false, error: "Mês inválido." }, { status: 400 });
  const { data, error } = await ctx.supabase.from("professor_ponto_fechamentos").select("*").eq("escola_id", ctx.escolaId).eq("mes", `${month.data}-01`).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, fechamento: data ?? { status: "aberto", mes: `${month.data}-01` } });
}

export async function POST(req: Request) {
  const ctx = await context();
  if (ctx.error || !ctx.auth || !ctx.escolaId) return ctx.error;
  const parsed = z.object({ month: Month, action: z.enum(["fechar", "reabrir"]), motivo: z.string().trim().max(1000).optional() }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados de fechamento inválidos." }, { status: 400 });
  if (parsed.data.action === "reabrir" && (!parsed.data.motivo || parsed.data.motivo.length < 10)) return NextResponse.json({ ok: false, error: "A reabertura exige um motivo com pelo menos 10 caracteres." }, { status: 400 });
  const mes = `${parsed.data.month}-01`;
  const { data: current } = await ctx.supabase.from("professor_ponto_fechamentos").select("*").eq("escola_id", ctx.escolaId).eq("mes", mes).maybeSingle();
  if (parsed.data.action === "fechar" && current?.status === "fechado") return NextResponse.json({ ok: false, error: "Este mês já está fechado." }, { status: 409 });
  if (parsed.data.action === "reabrir" && current?.status !== "fechado") return NextResponse.json({ ok: false, error: "Este mês não está fechado." }, { status: 409 });
  const before = current ?? { status: "aberto", mes };
  const values = parsed.data.action === "fechar"
    ? { escola_id: ctx.escolaId, mes, status: "fechado", fechado_por: ctx.auth.user.id, fechado_em: new Date().toISOString(), reaberto_por: null, reaberto_em: null, motivo_reabertura: null, updated_at: new Date().toISOString() }
    : { escola_id: ctx.escolaId, mes, status: "aberto", reaberto_por: ctx.auth.user.id, reaberto_em: new Date().toISOString(), motivo_reabertura: parsed.data.motivo, updated_at: new Date().toISOString() };
  const { data, error } = await ctx.supabase.from("professor_ponto_fechamentos").upsert(values, { onConflict: "escola_id,mes" }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  const audit = await ctx.supabase.from("audit_logs").insert({ escola_id: ctx.escolaId, actor_id: ctx.auth.user.id, action: parsed.data.action === "fechar" ? "PONTO_PROFESSOR_FECHADO" : "PONTO_PROFESSOR_REABERTO", entity: "professor_ponto_fechamentos", entity_id: data.id, portal: "secretaria", details: { motivo: parsed.data.motivo ?? null }, before, after: data });
  if (audit.error) return NextResponse.json({ ok: false, error: `Operação concluída, mas a auditoria falhou: ${audit.error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, fechamento: data });
}
