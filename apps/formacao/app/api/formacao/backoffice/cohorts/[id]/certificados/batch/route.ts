import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "super_admin",
  "global_admin",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = p.id;
  const body = (await request.json().catch(() => null)) as {
    user_ids: string[];
  } | null;

  if (!body?.user_ids || !Array.isArray(body.user_ids)) {
    return NextResponse.json({ ok: false, error: "user_ids inválidos" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  // Emissão real simplificada: chamar o RPC tenant_emitir_certificado_batch ou iterar
  // Para este protótipo, vamos usar o RPC se existir, ou simular o sucesso se for apenas para frontend
  // Mas vamos tentar ser o mais real possível.
  
  const { data, error } = await s.rpc("formacao_emitir_certificados_batch", {
    p_escola_id: auth.escolaId,
    p_cohort_id: cohortId,
    p_user_ids: body.user_ids,
  });

  if (error) {
    console.error("Erro ao emitir certificados em massa:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, count: body.user_ids.length });
}
