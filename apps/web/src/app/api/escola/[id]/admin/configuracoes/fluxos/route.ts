import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const stepSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  role: z.string().min(1).max(80),
  mandatory: z.boolean(),
  active: z.boolean(),
  sla_hours: z.number().int().min(0).max(720),
});

const bodySchema = z.object({
  steps: z.array(stepSchema).min(1).max(12),
});

async function authorize(requestedEscolaId: string) {
  const supabase = await supabaseServerTyped<Database>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, escolaId: null, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
  if (!escolaId || escolaId !== requestedEscolaId) {
    return { supabase, user, escolaId: null, response: NextResponse.json({ ok: false, error: "Sem vínculo com a escola" }, { status: 403 }) };
  }
  const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
  if (!authz.allowed) return { supabase, user, escolaId, response: NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 }) };
  return { supabase, user, escolaId, response: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (auth.response || !auth.escolaId) return auth.response;

  const db = auth.supabase as any;
  const [{ data: config, error }, { data: activeYear }] = await Promise.all([
    db.from("school_workflow_configs").select("academic_year_id,grade_workflow,updated_at").eq("escola_id", auth.escolaId).maybeSingle(),
    auth.supabase.from("anos_letivos").select("id,ano,data_inicio,data_fim").eq("escola_id", auth.escolaId).eq("ativo", true).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, config: config ?? null, active_year: activeYear ?? null });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (auth.response || !auth.escolaId || !auth.user) return auth.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Pipeline de notas inválido" }, { status: 400 });

  const { data: activeYear, error: yearError } = await auth.supabase
    .from("anos_letivos")
    .select("id,ano")
    .eq("escola_id", auth.escolaId)
    .eq("ativo", true)
    .maybeSingle();
  if (yearError) return NextResponse.json({ ok: false, error: yearError.message }, { status: 500 });
  if (!activeYear) return NextResponse.json({ ok: false, error: "Nenhum ano letivo operacional ativo" }, { status: 409 });

  const { data, error } = await (auth.supabase as any)
    .from("school_workflow_configs")
    .upsert({ escola_id: auth.escolaId, academic_year_id: activeYear.id, grade_workflow: parsed.data.steps, updated_by: auth.user.id }, { onConflict: "escola_id" })
    .select("academic_year_id,grade_workflow,updated_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, config: data, active_year: activeYear });
}
