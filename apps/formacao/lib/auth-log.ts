export type AuthAction = "login" | "redirect" | "deny" | "resolve_context_failed";

type AuthEvent = {
  action: AuthAction;
  route: string;
  user_id?: string | null;
  tenant_id?: string | null;
  tenant_type?: "k12" | "formacao" | null;
  details?: Record<string, unknown>;
};

export function logAuthEvent(event: AuthEvent) {
  const payload = {
    user_id: event.user_id ?? null,
    tenant_id: event.tenant_id ?? null,
    tenant_type: event.tenant_type ?? null,
    route: event.route,
    action: event.action,
    timestamp: new Date().toISOString(),
    ...(event.details ? { details: event.details } : {}),
  };
  console.info(JSON.stringify(payload));
}

