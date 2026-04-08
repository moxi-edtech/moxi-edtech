import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_financeiro",
  "formacao_admin",
  "super_admin",
  "global_admin",
];

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as any;
  const { data, error } = await s
    .from("formacao_clientes_b2b")
    .select("id, nome_fantasia, razao_social, nif, email_financeiro, telefone, status")
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    nome_fantasia?: string;
    razao_social?: string;
    nif?: string;
    email_financeiro?: string;
    telefone?: string;
  } | null;

  const nome = String(body?.nome_fantasia ?? "").trim();
  if (!nome) {
    return NextResponse.json({ ok: false, error: "nome_fantasia é obrigatório" }, { status: 400 });
  }

  const s = auth.supabase as any;
  const { data, error } = await s
    .from("formacao_clientes_b2b")
    .insert({
      escola_id: auth.escolaId,
      nome_fantasia: nome,
      razao_social: String(body?.razao_social ?? "").trim() || null,
      nif: String(body?.nif ?? "").trim() || null,
      email_financeiro: String(body?.email_financeiro ?? "").trim() || null,
      telefone: String(body?.telefone ?? "").trim() || null,
      status: "ativo",
    })
    .select("id, nome_fantasia, razao_social, nif, email_financeiro, telefone, status")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    nome_fantasia?: string;
    razao_social?: string | null;
    nif?: string | null;
    email_financeiro?: string | null;
    telefone?: string | null;
    status?: "ativo" | "inativo";
  } | null;

  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.nome_fantasia === "string") patch.nome_fantasia = body.nome_fantasia.trim();
  if (body?.razao_social !== undefined) patch.razao_social = body.razao_social ? String(body.razao_social).trim() : null;
  if (body?.nif !== undefined) patch.nif = body.nif ? String(body.nif).trim() : null;
  if (body?.email_financeiro !== undefined) patch.email_financeiro = body.email_financeiro ? String(body.email_financeiro).trim() : null;
  if (body?.telefone !== undefined) patch.telefone = body.telefone ? String(body.telefone).trim() : null;
  if (body?.status && ["ativo", "inativo"].includes(body.status)) patch.status = body.status;

  const s = auth.supabase as any;
  const { data, error } = await s
    .from("formacao_clientes_b2b")
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .eq("id", id)
    .select("id, nome_fantasia, razao_social, nif, email_financeiro, telefone, status")
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
    .from("formacao_clientes_b2b")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
