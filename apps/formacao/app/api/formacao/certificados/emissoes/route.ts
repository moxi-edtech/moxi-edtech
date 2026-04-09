import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

function buildDocNumber(escolaId: string) {
  const seed = Date.now().toString().slice(-8);
  return `CF-${escolaId.slice(0, 6).toUpperCase()}-${seed}`;
}

export async function GET() {
  const auth = await requireFormacaoRoles([
    "formacao_admin",
    "formacao_secretaria",
    "formacao_financeiro",
    "formando",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  let query = s
    .from("formacao_certificados_emitidos")
    .select("id, numero_documento, emitido_em, formando_user_id, cohort_id, template_id")
    .eq("escola_id", auth.escolaId)
    .order("emitido_em", { ascending: false })
    .limit(300);

  if (auth.role === "formando") {
    query = query.eq("formando_user_id", auth.userId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles([
    "formacao_admin",
    "formacao_secretaria",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    template_id?: string;
    formando_user_id?: string;
    cohort_id?: string;
    numero_documento?: string;
    payload_snapshot?: Record<string, unknown>;
  } | null;

  const formandoUserId = String(body?.formando_user_id ?? "").trim();
  if (!formandoUserId) {
    return NextResponse.json({ ok: false, error: "formando_user_id é obrigatório" }, { status: 400 });
  }

  const numero = String(body?.numero_documento ?? "").trim() || buildDocNumber(auth.escolaId || "CF");

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_certificados_emitidos")
    .insert({
      escola_id: auth.escolaId,
      template_id: String(body?.template_id ?? "").trim() || null,
      formando_user_id: formandoUserId,
      cohort_id: String(body?.cohort_id ?? "").trim() || null,
      numero_documento: numero,
      payload_snapshot: body?.payload_snapshot ?? {},
      created_by: auth.userId,
    })
    .select("id, numero_documento, emitido_em, formando_user_id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request) {
  const auth = await requireFormacaoRoles([
    "formacao_admin",
    "formacao_secretaria",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const s = auth.supabase as FormacaoSupabaseClient;
  const { error } = await s
    .from("formacao_certificados_emitidos")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
