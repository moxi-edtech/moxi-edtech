export type FunnelEventName =
  | "mentor_dashboard_view"
  | "mentor_vendas_view"
  | "mentor_mentorias_view"
  | "mentor_nova_mentoria_view"
  | "mentor_cta_click"
  | "mentor_mentoria_submit_started"
  | "mentor_mentoria_submit_success"
  | "mentor_mentoria_submit_failed"
  | "mentor_checkout_submit_success"
  | "mentor_checkout_submit_failed"
  | "self_service_inscricao_submit_success"
  | "self_service_inscricao_submit_failed";

export type FunnelEventPayload = {
  event: FunnelEventName;
  stage: "dashboard" | "mentorias" | "nova_mentoria" | "vendas" | "checkout" | "inscricao";
  path?: string;
  tenant_slug?: string | null;
  tenant_id?: string | null;
  user_id?: string | null;
  source?: string;
  details?: Record<string, unknown>;
};

export function logFunnelEvent(payload: FunnelEventPayload) {
  console.info(
    JSON.stringify({
      ...payload,
      event_type: "funnel_event",
      timestamp: new Date().toISOString(),
    })
  );
}
