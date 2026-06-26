import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "~types/supabase";
import type { DBWithRPC } from "@/types/supabase-augment";
import {
  AI_ACTIONS_ACCESS_ROLES,
  AI_ACTIONS_FINANCE_ROLES,
  AI_ACTIONS_SECRETARIA_ROLES,
} from "@/lib/roles/ai-roles";

export type AiActionType =
  | "finance_message"
  | "communication_draft"
  | "school_summary"
  | "student_summary"
  | "help_navigation"
  | "operational_recommendation";

export type AiActionStatus =
  | "draft"
  | "review_required"
  | "approved"
  | "rejected"
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export type AiRiskLevel = "low" | "medium" | "high";

export type AiActionModule =
  | "dashboard"
  | "financeiro"
  | "secretaria"
  | "academico"
  | "comunicacao"
  | "classe_ai";

export type AiActionRow = DBWithRPC["public"]["Tables"]["ai_actions"]["Row"];
export type AiActionInsert = DBWithRPC["public"]["Tables"]["ai_actions"]["Insert"];
export type AiActionUpdate = DBWithRPC["public"]["Tables"]["ai_actions"]["Update"];
export type AiActionsClient = SupabaseClient<DBWithRPC>;

export const AI_ACTION_STATUSES: AiActionStatus[] = [
  "draft",
  "review_required",
  "approved",
  "rejected",
  "queued",
  "sending",
  "sent",
  "failed",
  "cancelled",
];

export const AI_ACTION_TYPES: AiActionType[] = [
  "finance_message",
  "communication_draft",
  "school_summary",
  "student_summary",
  "help_navigation",
  "operational_recommendation",
];

export const AI_ACTION_MODULES: AiActionModule[] = [
  "dashboard",
  "financeiro",
  "secretaria",
  "academico",
  "comunicacao",
  "classe_ai",
];

export const AI_RISK_LEVELS: AiRiskLevel[] = ["low", "medium", "high"];

export function normalizeAiRole(role: string | null | undefined) {
  return String(role ?? "").trim().toLowerCase();
}

export function canAccessAiActions(role: string | null | undefined) {
  return AI_ACTIONS_ACCESS_ROLES.includes(normalizeAiRole(role));
}

export function canReviewAiAction(role: string | null | undefined, actionType: AiActionType) {
  const normalized = normalizeAiRole(role);
  if (actionType === "finance_message") {
    return AI_ACTIONS_FINANCE_ROLES.includes(normalized);
  }
  return AI_ACTIONS_SECRETARIA_ROLES.includes(normalized);
}

function metadataTargetsWaha(metadata: Json | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const record = metadata as Record<string, unknown>;
  const channel = String(record.channel ?? record.provider ?? "").toLowerCase();
  return channel === "waha";
}

export function requiresAiActionApproval(params: {
  actionType: AiActionType;
  riskLevel: AiRiskLevel;
  metadata?: Json;
}) {
  return (
    params.riskLevel === "high" ||
    params.actionType === "finance_message" ||
    metadataTargetsWaha(params.metadata)
  );
}

export async function getUserAiRole(
  supabase: AiActionsClient,
  schoolId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", schoolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return normalizeAiRole(data?.papel);
}

export async function createAiAction(
  supabase: AiActionsClient,
  params: {
    schoolId: string;
    createdBy: string;
    actionType: AiActionType;
    sourceModule: AiActionModule;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    title: string;
    summary?: string | null;
    content: string;
    metadata?: Json;
    status?: Extract<AiActionStatus, "draft" | "review_required">;
    riskLevel?: AiRiskLevel;
    requiresApproval?: boolean;
  }
) {
  const riskLevel = params.riskLevel ?? "low";
  const metadata = params.metadata ?? {};
  const forcedApproval = requiresAiActionApproval({
    actionType: params.actionType,
    riskLevel,
    metadata,
  });
  const requiresApproval = forcedApproval || params.requiresApproval === true;
  const status = params.status ?? (requiresApproval ? "review_required" : "draft");

  const insert: AiActionInsert = {
    school_id: params.schoolId,
    created_by: params.createdBy,
    action_type: params.actionType,
    source_module: params.sourceModule,
    source_entity_type: params.sourceEntityType ?? null,
    source_entity_id: params.sourceEntityId ?? null,
    title: params.title.slice(0, 180),
    summary: params.summary?.slice(0, 600) ?? null,
    content: params.content,
    metadata,
    status,
    risk_level: riskLevel,
    requires_approval: requiresApproval,
  };

  const { data, error } = await supabase
    .from("ai_actions")
    .insert(insert)
    .select("*")
    .single();

  if (error) throw error;
  return data as AiActionRow;
}

export async function transitionAiAction(
  supabase: AiActionsClient,
  params: {
    action: AiActionRow;
    userId: string;
    userRole: string;
    transition: "approve" | "reject" | "cancel" | "retry";
  }
) {
  if (!canReviewAiAction(params.userRole, params.action.action_type)) {
    throw new Error("Sem permissão para rever esta ação.");
  }

  const now = new Date().toISOString();
  let update: AiActionUpdate;

  switch (params.transition) {
    case "approve":
      if (!["draft", "review_required", "failed"].includes(params.action.status)) {
        throw new Error("Esta ação não pode ser aprovada neste estado.");
      }
      update = {
        status: "approved",
        approved_by: params.userId,
        approved_at: now,
        rejected_by: null,
        rejected_at: null,
        last_error: null,
      };
      break;
    case "reject":
      if (!["draft", "review_required", "approved", "failed"].includes(params.action.status)) {
        throw new Error("Esta ação não pode ser rejeitada neste estado.");
      }
      update = {
        status: "rejected",
        rejected_by: params.userId,
        rejected_at: now,
      };
      break;
    case "cancel":
      if (["sent", "sending"].includes(params.action.status)) {
        throw new Error("Esta ação já está em envio ou enviada.");
      }
      update = {
        status: "cancelled",
      };
      break;
    case "retry":
      if (params.action.status !== "failed") {
        throw new Error("Apenas ações com falha podem ser reenviadas.");
      }
      update = {
        status: params.action.requires_approval ? "review_required" : "draft",
        failed_at: null,
        last_error: null,
      };
      break;
  }

  const { data, error } = await supabase
    .from("ai_actions")
    .update(update)
    .eq("id", params.action.id)
    .eq("school_id", params.action.school_id)
    .select("*")
    .single();

  if (error) throw error;
  return data as AiActionRow;
}
