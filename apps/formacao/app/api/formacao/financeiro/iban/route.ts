import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireFormacaoRoles([
    "formacao_financeiro",
    "formacao_admin",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;

  const { data: binding, error } = await s
    .from("fiscal_escola_bindings")
    .select("metadata, empresa_id")
    .eq("escola_id", auth.escolaId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  let iban = "";
  if (binding?.empresa_id) {
    const { data: empresa } = await s
      .from("fiscal_empresas")
      .select("metadata")
      .eq("id", binding.empresa_id)
      .maybeSingle();

    const bindingMetadata = (binding.metadata ?? null) as Record<string, unknown> | null;
    const empresaMetadata = (empresa?.metadata ?? null) as Record<string, unknown> | null;
    const metadataIban =
      (typeof bindingMetadata?.iban === "string" ? bindingMetadata.iban : null) ??
      (typeof empresaMetadata?.iban === "string" ? empresaMetadata.iban : null);
    if (metadataIban) iban = metadataIban;
  }

  return NextResponse.json({ ok: true, iban });
}
