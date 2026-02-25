import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const searchParamsSchema = z.object({
  escolaId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = searchParamsSchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { escolaId, limit } = parsed.data;
  const supabase = await createClient();

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ["secretaria", "admin", "admin_escola", "staff_admin"],
  });
  if (authError) return authError;

  const { data, error } = await supabase
    .from("candidaturas")
    .select("id, nome_candidato, status, created_at, updated_at")
    .eq("escola_id", escolaId)
    .in("status", ["rascunho", "pendente", "submetida", "em_analise"])
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit ?? 20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] }, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = searchParamsSchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { escolaId } = parsed.data;
  const supabase = await createClient();

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ["secretaria", "admin", "admin_escola", "staff_admin"],
  });
  if (authError) return authError;

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  const all = body?.all === true;
  if (!id && !all) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }

  if (all) {
    const { error: delErr } = await supabase
      .from("candidaturas")
      .delete()
      .eq("escola_id", escolaId)
      .eq("status", "rascunho");

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, deleted: "all" });
  }

  const { data: cand, error: candErr } = await supabase
    .from("candidaturas")
    .select("id, escola_id, status")
    .eq("id", id)
    .maybeSingle();

  if (candErr || !cand) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }

  if (cand.escola_id !== escolaId) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const status = String(cand.status ?? "").toLowerCase();
  if (status !== "rascunho") {
    return NextResponse.json({ error: "Só é permitido apagar rascunhos" }, { status: 400 });
  }

  const { error: delErr } = await supabase
    .from("candidaturas")
    .delete()
    .eq("id", id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
