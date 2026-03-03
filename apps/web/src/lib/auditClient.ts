"use client";

export type AuditEvent = {
  escolaId?: string | null;
  portal:
    | "admin_escola"
    | "secretaria"
    | "financeiro"
    | "professor"
    | "aluno"
    | "super_admin"
    | "outro";
  acao: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, any>;
};

export async function recordAuditClient(evt: AuditEvent) {
  try {
    if (!evt.entity) {
      console.warn("recordAuditClient chamado sem entity; ignorando log.");
      return;
    }

    const res = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evt),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("recordAuditClient error:", err.error || res.statusText);
    }
  } catch (err: any) {
    console.warn("recordAuditClient exception:", err?.message || err);
  }
}
