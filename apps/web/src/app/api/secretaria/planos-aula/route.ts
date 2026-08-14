import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROLES = ["secretaria", "admin_secretaria", "admin_escola", "admin_financeiro", "admin", "staff_admin", "diretor"] as const;
const ReviewSchema = z.object({ status: z.enum(["aprovado", "devolvido", "arquivado"]), returned_reason: z.string().trim().max(2000).nullable().optional() });

async function context() {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, user: null, escolaId: null, authz: null };
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return { supabase, user: auth.user, escolaId: null, authz: null };
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...ROLES] });
  return { supabase, user: auth.user, escolaId, authz };
}

export async function GET() {
  const { supabase, user, escolaId, authz } = await context();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  if (authz?.error) return authz.error;
  const { data, error } = await supabase.from("planos_aula").select("id, data, status, tema, objetivos, returned_reason, professor_id, turma_disciplina_id, created_at, updated_at").eq("escola_id", escolaId).in("status", ["enviado", "devolvido"]).order("updated_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function PATCH(req: Request) {
  const { supabase, user, escolaId, authz } = await context();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  if (authz?.error) return authz.error;
  const parsed = ReviewSchema.safeParse(await req.json().catch(() => ({})));
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !parsed.success) return NextResponse.json({ ok: false, error: "Informe o plano e um estado válido" }, { status: 400 });
  if (parsed.data.status === "devolvido" && !parsed.data.returned_reason) return NextResponse.json({ ok: false, error: "Informe o motivo da devolução" }, { status: 400 });
  const { data, error } = await supabase.from("planos_aula").update({ status: parsed.data.status, returned_reason: parsed.data.status === "devolvido" ? parsed.data.returned_reason : null, approved_by: parsed.data.status === "aprovado" ? user.id : null, approved_at: parsed.data.status === "aprovado" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).eq("escola_id", escolaId).select("id, status, returned_reason, approved_at, updated_at").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "Plano não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, item: data });
}
