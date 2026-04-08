import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { FeatureKey } from "@/config/plans";
import { HttpError } from "@/lib/errors";
import type { Database } from "~types/supabase";
import { getFeatureDeniedMessage, isFeatureAllowed } from "@/lib/plan/featureMatrix";
import type { ProductContext } from "@/lib/permissions";
import {
  detectProductContextFromHostname,
  inferTenantTypeFromRole,
  resolveTenantContext,
  type TenantType,
} from "@moxi/tenant-sdk";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

type DBWithFeature = Database & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      escolas: Database["public"]["Tables"]["escolas"] & {
        Row: Database["public"]["Tables"]["escolas"]["Row"] & { plano_atual?: string | null };
      };
    };
    Functions: Database["public"]["Functions"];
  };
};

type RequireFeatureResult = {
  escolaId: string;
  plano: string;
  userId: string;
  tenantType: TenantType;
  productContext: ProductContext;
};

type RequireFeatureOptions = {
  productContext?: ProductContext;
  requestedEscolaId?: string | null;
};

export async function requireFeature(
  feature: FeatureKey,
  options?: RequireFeatureOptions
): Promise<RequireFeatureResult> {
  const supabase = await supabaseServerTyped<DBWithFeature>();

  const { data, error: authError } = await supabase.auth.getUser();
  const user = data?.user;

  if (authError || !user) {
    throw new HttpError(401, "UNAUTHENTICATED", "Faça login para continuar.");
  }

  const metadataEscolaId =
    (user.user_metadata as { escola_id?: string | null } | null)?.escola_id ??
    (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ??
    null;

  const requestHeaders = await headers();
  const productFromHost = detectProductContextFromHostname(requestHeaders.get("host"));
  const productContext = options?.productContext ?? (productFromHost === "formacao" ? "formacao" : "k12");

  const tenantContext = await resolveTenantContext({
    client: supabase as unknown as SupabaseClient<Database>,
    userId: user.id,
    productContext,
    requestedTenantId: options?.requestedEscolaId ?? metadataEscolaId,
  });

  if (!tenantContext?.tenant_id) {
    throw new HttpError(403, "NO_SCHOOL", "Usuário sem escola associada.");
  }

  const { data: escola, error: schoolError } = await supabase
    .from("escolas")
    .select("plano_atual")
    .eq("id", tenantContext.tenant_id)
    .maybeSingle();

  if (schoolError) {
    throw new HttpError(500, "FEATURE_CHECK_FAILED", "Falha ao validar plano.");
  }

  const plano = String(escola?.plano_atual ?? "essencial").toLowerCase();
  const tenantType =
    tenantContext.tenant_type ??
    inferTenantTypeFromRole(tenantContext.user_role) ??
    "k12";

  if (!isFeatureAllowed(plano, feature, { productContext, tenantType })) {
    throw new HttpError(403, "PLAN_FEATURE_REQUIRED", getFeatureDeniedMessage(plano, feature));
  }

  return {
    escolaId: tenantContext.tenant_id,
    plano,
    userId: user.id,
    tenantType,
    productContext,
  };
}
