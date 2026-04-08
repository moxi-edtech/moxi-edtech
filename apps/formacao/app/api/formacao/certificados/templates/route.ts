import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "super_admin",
  "global_admin",
];

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as any;
  const { data, error } = await s
    .from("formacao_certificado_templates")
    .select("id, nome, diretora_nome, cargo_assinatura, base_legal, regime_default, ativo, updated_at")
    .eq("escola_id", auth.escolaId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    nome?: string;
    diretora_nome?: string;
    cargo_assinatura?: string;
    base_legal?: string;
    regime_default?: string;
    ativo?: boolean;
  } | null;

  const nome = String(body?.nome ?? "").trim();
  if (!nome) {
    return NextResponse.json({ ok: false, error: "nome é obrigatório" }, { status: 400 });
  }

  const s = auth.supabase as any;
  const { data, error } = await s
    .from("formacao_certificado_templates")
    .insert({
      escola_id: auth.escolaId,
      nome,
      diretora_nome: String(body?.diretora_nome ?? "").trim() || null,
      cargo_assinatura: String(body?.cargo_assinatura ?? "").trim() || null,
      base_legal: String(body?.base_legal ?? "").trim() || null,
      regime_default: String(body?.regime_default ?? "").trim() || null,
      ativo: body?.ativo !== false,
      created_by: auth.userId,
    })
    .select("id, nome, diretora_nome, cargo_assinatura, base_legal, regime_default, ativo")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    nome?: string;
    diretora_nome?: string | null;
    cargo_assinatura?: string | null;
    base_legal?: string | null;
    regime_default?: string | null;
    ativo?: boolean;
  } | null;

  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.nome === "string") patch.nome = body.nome.trim();
  if (body?.diretora_nome !== undefined) patch.diretora_nome = body.diretora_nome ? String(body.diretora_nome).trim() : null;
  if (body?.cargo_assinatura !== undefined) patch.cargo_assinatura = body.cargo_assinatura ? String(body.cargo_assinatura).trim() : null;
  if (body?.base_legal !== undefined) patch.base_legal = body.base_legal ? String(body.base_legal).trim() : null;
  if (body?.regime_default !== undefined) patch.regime_default = body.regime_default ? String(body.regime_default).trim() : null;
  if (typeof body?.ativo === "boolean") patch.ativo = body.ativo;

  const s = auth.supabase as any;
  const { data, error } = await s
    .from("formacao_certificado_templates")
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .eq("id", id)
    .select("id, nome, diretora_nome, cargo_assinatura, base_legal, regime_default, ativo")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const s = auth.supabase as any;
  const { error } = await s
    .from("formacao_certificado_templates")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
