"use client";

import { createClient } from "@/lib/supabaseClient";

export type AuditEvent = {
  escolaId?: string | null;
  portal:
    | "admin_escola"
    | "secretaria"
    | "financeiro"
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

    const s = createClient() as any;

    const payload = {
      escola_id: evt.escolaId ?? null,
      portal: evt.portal,
      acao: evt.acao,
      tabela: evt.entity, // 👈 obrigatório pra satisfazer NOT NULL
      entity: evt.entity,
      entity_id: evt.entityId ?? null,
      details: evt.details ?? {},
    };

    const { error } = await s.from("audit_logs").insert(payload);
    if (error) {
      console.warn("recordAuditClient error:", error.message);
    }
  } catch (err: any) {
    console.warn("recordAuditClient exception:", err?.message || err);
  }
}
