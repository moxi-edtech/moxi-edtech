import "server-only";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { AI_WIDGET_ROLES } from "@/lib/roles/ai-roles";
import type { DBWithRPC } from "@/types/supabase-augment";

export interface ValidateAiAccessResult {
  ok: boolean;
  error?: string;
  userId?: string;
  role?: string;
  usageLogId?: string;
  settings?: {
    enabled: boolean;
    daily_limit: number;
    monthly_limit: number;
    allowed_features: string[];
  };
}

export async function updateAiUsageLog(
  usageLogId: string | undefined,
  payload: {
    status: "completed" | "error";
    inputPreview?: string;
    outputPreview?: string | null;
    errorMessage?: string | null;
    tokensInput?: number | null;
    tokensOutput?: number | null;
    provider?: string | null;
    model?: string | null;
  }
) {
  if (!usageLogId) return;

  const supabase = supabaseServerRole<DBWithRPC>();
  await supabase
    .from("ai_usage_logs")
    .update({
      status: payload.status,
      input_preview: payload.inputPreview?.slice(0, 500),
      output_preview: payload.outputPreview?.slice(0, 500) ?? null,
      error_message: payload.errorMessage ?? null,
      tokens_input: payload.tokensInput ?? null,
      tokens_output: payload.tokensOutput ?? null,
      provider: payload.provider ?? null,
      model: payload.model ?? null,
    })
    .eq("id", usageLogId);
}

export async function validateAiAccess(
  escolaId: string,
  feature: string,
  promptTemplateKey?: string
): Promise<ValidateAiAccessResult> {
  // 1. Check if AI is globally enabled in environment variables
  if (!process.env.AI_ENABLED || process.env.AI_ENABLED === "false") {
    return { ok: false, error: "O KLASSE AI está desativado pelo administrador do sistema." };
  }

  // 2. Validate authentication and get user
  const supabase = await supabaseRouteClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return { ok: false, error: "Usuário não autenticado." };
  }
  const userId = userData.user.id;

  // 3. Validate user role inside the school
  const { data: roleData, error: roleError } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", escolaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (roleError || !roleData) {
    return { ok: false, error: "Usuário não possui vínculo com esta escola." };
  }

  const role = roleData.papel?.toLowerCase() || "";

  if (!AI_WIDGET_ROLES.includes(role)) {
    return { ok: false, error: "Apenas perfis administrativos podem utilizar o KLASSE AI." };
  }

  // 4. Retrieve school setting limits
  const adminClient = supabaseServerRole<DBWithRPC>();
  const { data: settings, error: settingsError } = await adminClient
    .from("ai_school_settings")
    .select("enabled, daily_limit, monthly_limit, allowed_features")
    .eq("school_id", escolaId)
    .maybeSingle();

  if (settingsError || !settings) {
    return { ok: false, error: "A IA não está configurada ou habilitada para esta escola." };
  }

  if (!settings.enabled) {
    return { ok: false, error: "A IA está desabilitada nas configurações desta escola." };
  }



  // 5. Call claim_ai_usage_slot to atomically reserve a slot and check limits
  const { data: logId, error: rpcError } = await adminClient.rpc("claim_ai_usage_slot", {
    p_school_id: escolaId,
    p_user_id: userId,
    p_feature: feature,
    p_prompt_template_key: promptTemplateKey || null,
  });

  if (rpcError) {
    // If rate limit or other error occurred in the DB
    return { ok: false, error: rpcError.message };
  }

  const dailyLimit = settings.daily_limit ?? parseInt(process.env.AI_DAILY_LIMIT_DEFAULT || "20", 10);
  const monthlyLimit = settings.monthly_limit ?? parseInt(process.env.AI_MONTHLY_LIMIT_DEFAULT || "500", 10);

  return {
    ok: true,
    userId,
    role,
    usageLogId: logId,
    settings: {
      enabled: settings.enabled,
      daily_limit: dailyLimit,
      monthly_limit: monthlyLimit,
      allowed_features: Array.isArray(settings.allowed_features) ? (settings.allowed_features as string[]) : [],
    },
  };
}
