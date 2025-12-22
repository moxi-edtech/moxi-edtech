import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { FeatureKey } from "@/config/plans";
import { HttpError } from "@/lib/errors";
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("escola_id, current_escola_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new HttpError(500, "PROFILE_FETCH_FAILED", "Falha ao obter perfil.");
  }

  const escolaId = (profile as any)?.current_escola_id ?? (profile as any)?.escola_id ?? null;
  if (!escolaId) {
    throw new HttpError(403, "NO_SCHOOL", "Usuário sem escola associada.");
  }

  const { data: escolaRow, error: escolaError } = await supabase
    .from("escolas")
    .select("id, plano_atual, plano")
    .eq("id", escolaId)
    .maybeSingle();

  if (escolaError) {
    throw new HttpError(500, "SCHOOL_FETCH_FAILED", "Falha ao carregar escola.");
  }

  if (!escolaRow) {
    throw new HttpError(404, "SCHOOL_NOT_FOUND", "Escola não encontrada.");
  }

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

  const planoAtual = (escolaRow as any)?.plano_atual ?? (escolaRow as any)?.plano ?? null;

  return {
    escolaId,
    plano: planoAtual,
    userId: user.id,
  };
}
