import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const StatusSchema = z.object({ status: z.enum(["rascunho", "enviado"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  const { data: professor } = await supabase.from("professores").select("id").eq("escola_id", escolaId).eq("profile_id", auth.user.id).maybeSingle();
  const parsed = StatusSchema.safeParse(await req.json().catch(() => ({})));
  if (!escolaId || !professor?.id || !parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
  const { id } = await params;
  const { data, error } = await supabase.from("planos_aula").update({ status: parsed.data.status, submitted_at: parsed.data.status === "enviado" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).eq("escola_id", escolaId).eq("professor_id", professor.id).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}
