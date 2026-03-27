import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type JsonRecord = Record<string, unknown>;
type RouteSupabase = SupabaseClient<Database>;

type EmpresaContext = {
  empresaId: string | null;
  source: "binding" | "membership" | "none";
};

function jsonError(status: number, code: string, message: string, details?: JsonRecord) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    { status }
  );
}

async function resolveEmpresaContext({
  supabase,
  userId,
  escolaId,
}: {
  supabase: RouteSupabase;
  userId: string;
  escolaId: string | null;
}): Promise<EmpresaContext> {
  if (escolaId) {
    const { data: binding } = await supabase
      .from("fiscal_escola_bindings")
      .select("empresa_id, is_primary, effective_from")
      .eq("escola_id", escolaId)
      .is("effective_to", null)
      .order("is_primary", { ascending: false })
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (binding?.empresa_id) {
      return { empresaId: binding.empresa_id, source: "binding" };
    }
  }

  const { data: membership } = await supabase
    .from("fiscal_empresa_users")
    .select("empresa_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.empresa_id) {
    return { empresaId: membership.empresa_id, source: "membership" };
  }

  return { empresaId: null, source: "none" };
}

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const supabase = await supabaseRouteClient<Database>();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(401, "UNAUTHENTICATED", "Utilizador não autenticado.", {
        request_id: requestId,
      });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    const ctx = await resolveEmpresaContext({ supabase, userId: user.id, escolaId });

    const [{ data: escola }, { data: empresa }, { data: chave }] = await Promise.all([
      escolaId
        ? supabase
            .from("escolas")
            .select("id, nome, nif")
            .eq("id", escolaId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ctx.empresaId
        ? supabase
            .from("fiscal_empresas")
            .select("id, nome, nif")
            .eq("id", ctx.empresaId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      ctx.empresaId
        ? supabase
            .from("fiscal_chaves")
            .select("key_version, private_key_ref, public_key_pem, key_fingerprint, status")
            .eq("empresa_id", ctx.empresaId)
            .eq("status", "active")
            .order("key_version", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const envRegion = process.env.AWS_REGION?.trim() || "";
    const envKeyId = process.env.AWS_KMS_KEY_ID?.trim() || "";
    const envPrivateKeyRef = envRegion && envKeyId ? `kms://${envRegion}/${envKeyId}` : envKeyId;
    const saftProductId = process.env.SAFT_PRODUCT_ID?.trim() || "KLASSE/MoxiNexa";
    const saftSoftwareCertificateNumber =
      process.env.SAFT_SOFTWARE_CERTIFICATE_NUMBER?.trim() || "0";
    const saftTaxAccountingBasis = process.env.SAFT_TAX_ACCOUNTING_BASIS?.trim() || "F";

    return NextResponse.json({
      ok: true,
      data: {
        request_id: requestId,
        escola_id: escolaId,
        empresa_id: ctx.empresaId,
        source: ctx.source,
        razao_social_default: empresa?.nome ?? escola?.nome ?? "",
        nif_default: empresa?.nif ?? escola?.nif ?? "",
        key_version_default: chave?.key_version ?? 1,
        private_key_ref_default: chave?.private_key_ref ?? envPrivateKeyRef ?? "",
        public_key_pem_default: chave?.public_key_pem ?? "",
        key_fingerprint_default: chave?.key_fingerprint ?? "",
        saft_product_id_default: saftProductId,
        saft_software_certificate_number_default: saftSoftwareCertificateNumber,
        saft_tax_accounting_basis_default: saftTaxAccountingBasis,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno ao carregar defaults fiscais.";
    return jsonError(500, "FISCAL_SETUP_DEFAULTS_FAILED", message, { request_id: requestId });
  }
}
