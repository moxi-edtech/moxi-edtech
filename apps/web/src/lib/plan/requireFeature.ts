import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { FeatureKey } from "@/config/plans";
import { HttpError } from "@/lib/errors";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

type DBWithFeature = Database & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      escolas: Database["public"]["Tables"]["escolas"] & {
        Row: Database["public"]["Tables"]["escolas"]["Row"] & { plano_atual?: string | null };
      };
    };
    Functions: Database["public"]["Functions"] & {
      escola_has_feature: {
        Args: { p_escola_id: string; p_feature: FeatureKey };
        Returns: boolean;
      };
    };
  };
};

type RequireFeatureResult = {
  escolaId: string;
  plano: string | null;
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

  if (feature !== "fin_recibo_pdf") {
    const { data: allowed, error: rpcError } = await supabase.rpc("escola_has_feature", {
      p_escola_id: escolaId,
      p_feature: feature,
    });

    if (rpcError) {
      throw new HttpError(500, "FEATURE_CHECK_FAILED", "Falha ao validar plano.");
    }

    if (!allowed) {
      throw new HttpError(403, "FORBIDDEN", "Seu plano não inclui esta funcionalidade.");
    }
  }

  return {
    escolaId,
    plano: null,
    userId: user.id,
  };
}
