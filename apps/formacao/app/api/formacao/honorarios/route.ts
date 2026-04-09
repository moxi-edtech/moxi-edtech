import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

function buildRef(escolaId: string) {
  const stamp = Date.now().toString().slice(-7);
  return `HON-${escolaId.slice(0, 5).toUpperCase()}-${stamp}`;
}

const allowedRoles = [
  "formador",
  "formacao_financeiro",
  "formacao_admin",
  "super_admin",
  "global_admin",
];

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  let query = s
    .from("formacao_honorarios_lancamentos")
    .select("id, referencia, cohort_id, formador_user_id, horas_ministradas, valor_hora, bonus, desconto, valor_liquido, competencia, status")
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (auth.role === "formador") {
    query = query.eq("formador_user_id", auth.userId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    cohort_id?: string;
    formador_user_id?: string;
    referencia?: string;
    horas_ministradas?: number;
    valor_hora?: number;
    bonus?: number;
    desconto?: number;
    competencia?: string;
  } | null;

  const cohortId = String(body?.cohort_id ?? "").trim();
  const formadorUserId = auth.role === "formador" ? auth.userId : String(body?.formador_user_id ?? "").trim();
  const horas = Number(body?.horas_ministradas ?? 0);
  const valorHora = Number(body?.valor_hora ?? 0);
  const competencia = String(body?.competencia ?? "").trim();

  if (!cohortId || !formadorUserId || !competencia || horas <= 0 || valorHora <= 0) {
    return NextResponse.json(
      { ok: false, error: "cohort_id, formador_user_id, competencia, horas e valor_hora são obrigatórios" },
      { status: 400 }
    );
  }

  const referencia = String(body?.referencia ?? "").trim() || buildRef(auth.escolaId || "HON");

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_honorarios_lancamentos")
    .insert({
      escola_id: auth.escolaId,
      cohort_id: cohortId,
      formador_user_id: formadorUserId,
      referencia,
      horas_ministradas: horas,
      valor_hora: valorHora,
      bonus: Number(body?.bonus ?? 0),
      desconto: Number(body?.desconto ?? 0),
      competencia,
      status: "aberto",
      created_by: auth.userId,
    })
    .select("id, referencia, horas_ministradas, valor_hora, bonus, desconto, valor_liquido, competencia, status")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: "aberto" | "aprovado" | "pago" | "cancelado";
    horas_ministradas?: number;
    valor_hora?: number;
    bonus?: number;
    desconto?: number;
  } | null;

  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.status && ["aberto", "aprovado", "pago", "cancelado"].includes(body.status)) {
    patch.status = body.status;
  }
  if (body?.horas_ministradas !== undefined) patch.horas_ministradas = Number(body.horas_ministradas);
  if (body?.valor_hora !== undefined) patch.valor_hora = Number(body.valor_hora);
  if (body?.bonus !== undefined) patch.bonus = Number(body.bonus);
  if (body?.desconto !== undefined) patch.desconto = Number(body.desconto);

  let query = (auth.supabase as FormacaoSupabaseClient)
    .from("formacao_honorarios_lancamentos")
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (auth.role === "formador") {
    query = query.eq("formador_user_id", auth.userId);
  }

  const { data, error } = await query
    .select("id, referencia, horas_ministradas, valor_hora, bonus, desconto, valor_liquido, competencia, status")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  let query = (auth.supabase as FormacaoSupabaseClient)
    .from("formacao_honorarios_lancamentos")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (auth.role === "formador") {
    query = query.eq("formador_user_id", auth.userId);
  }

  const { error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
