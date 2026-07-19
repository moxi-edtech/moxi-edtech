import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "~types/supabase";
import type { DBWithRPC } from "@/types/supabase-augment";

export const AI_INSIGHT_STATUSES = ["new", "seen", "in_progress", "resolved", "ignored"] as const;
export const AI_INSIGHT_MODULES = ["financeiro", "secretaria", "academico", "direcao"] as const;
export const AI_INSIGHT_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;

export type AiInsightStatus = (typeof AI_INSIGHT_STATUSES)[number];
export type AiInsightModule = (typeof AI_INSIGHT_MODULES)[number];
export type AiInsightSeverity = (typeof AI_INSIGHT_SEVERITIES)[number];
export type AiInsightRow = DBWithRPC["public"]["Tables"]["ai_insights"]["Row"];
export type AiInsightInsert = DBWithRPC["public"]["Tables"]["ai_insights"]["Insert"];
export type AiInsightUpdate = DBWithRPC["public"]["Tables"]["ai_insights"]["Update"];
export type AiInsightsClient = SupabaseClient<DBWithRPC>;

export async function upsertAiInsight(
  client: AiInsightsClient,
  params: {
    schoolId: string;
    generatedBy: string;
    toolId: string;
    fingerprint: string;
    title: string;
    severity: AiInsightSeverity;
    module: AiInsightModule;
    explanation: string;
    evidence: Json;
    recommendation: string;
    suggestedAction?: Json | null;
  },
) {
  const now = new Date().toISOString();
  const insert: AiInsightInsert = {
    school_id: params.schoolId,
    generated_by: params.generatedBy,
    tool_id: params.toolId,
    fingerprint: params.fingerprint,
    title: params.title.slice(0, 180),
    severity: params.severity,
    module: params.module,
    explanation: params.explanation,
    evidence: params.evidence,
    recommendation: params.recommendation,
    suggested_action: params.suggestedAction ?? null,
    last_detected_at: now,
  };

  const { data, error } = await client
    .from("ai_insights")
    .upsert(insert, { onConflict: "school_id,fingerprint" })
    .select("*")
    .single();

  if (error) throw error;
  return data as AiInsightRow;
}

export async function transitionAiInsight(
  client: AiInsightsClient,
  params: {
    insightId: string;
    schoolId: string;
    status: Exclude<AiInsightStatus, "new">;
  },
) {
  const now = new Date().toISOString();
  const update: AiInsightUpdate = {
    status: params.status,
    seen_at: params.status === "seen" ? now : undefined,
    started_at: params.status === "in_progress" ? now : undefined,
    resolved_at: params.status === "resolved" ? now : undefined,
    ignored_at: params.status === "ignored" ? now : undefined,
  };

  const { data, error } = await client
    .from("ai_insights")
    .update(update)
    .eq("id", params.insightId)
    .eq("school_id", params.schoolId)
    .select("*")
    .single();

  if (error) throw error;
  return data as AiInsightRow;
}
