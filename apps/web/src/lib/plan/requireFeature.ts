import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { FeatureKey } from "@/config/plans";
import { HttpError } from "@/lib/errors";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { getFeatureDeniedMessage, isFeatureAllowed } from "@/lib/plan/featureMatrix";

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
};

export async function requireFeature(feature: FeatureKey): Promise<RequireFeatureResult> {
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

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, undefined, metadataEscolaId);
  if (!escolaId) {
    throw new HttpError(403, "NO_SCHOOL", "Usuário sem escola associada.");
  }

  const { data: escola, error: schoolError } = await supabase
    .from("escolas")
    .select("plano_atual")
    .eq("id", escolaId)
    .maybeSingle();

  if (schoolError) {
    throw new HttpError(500, "FEATURE_CHECK_FAILED", "Falha ao validar plano.");
  }

  const plano = String(escola?.plano_atual ?? "essencial").toLowerCase();

  if (!isFeatureAllowed(plano, feature)) {
    throw new HttpError(403, "PLAN_FEATURE_REQUIRED", getFeatureDeniedMessage(plano, feature));
  }

  return {
    escolaId,
    plano,
    userId: user.id,
  };
}
