import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { buildEmpresaStatusProfile } from "@/lib/talent-pool/routes-contract";

export const dynamic = "force-dynamic";

async function ensureEmpresaParceiraProfile(s: FormacaoSupabaseClient): Promise<void> {
  const rpcClient = s as unknown as {
    rpc: (fn: string, args: { p_nif: string | null }) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await rpcClient.rpc("ensure_empresa_parceira_profile", { p_nif: null });
  if (error) {
    console.warn("[talent-pool] ensure_empresa_parceira_profile failed:", error.message);
  }
}

export async function GET() {
  const auth = await requireFormacaoRoles([
    "formacao_admin",
    "formacao_secretaria",
    "formacao_financeiro",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const empresasTable: string = "empresas_parceiras";

  // First-login integration: always ensure partner profile exists.
  await ensureEmpresaParceiraProfile(s);

  const { data, error } = await s
    .from(empresasTable)
    .select("id, nif, dominio_email, is_verified, created_at, updated_at")
    .eq("id", auth.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    profile: buildEmpresaStatusProfile(data, auth.userId),
  });
}
