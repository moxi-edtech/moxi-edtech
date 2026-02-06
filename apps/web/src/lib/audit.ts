import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";
import type { Json } from "~types/supabase";

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
  entity: string; // nome lógico/tabela (ex: "alunos", "escolas")
  entityId?: string | null;
  details?: Record<string, Json> | Json;
};

export async function recordAuditServer(evt: AuditEvent) {
  try {
    // segurança: se alguém chamar sem entity, não quebra a request
    if (!evt.entity) {
      console.warn("recordAuditServer chamado sem entity; ignorando log.");
      return;
    }

    const s = await supabaseServer();

    const payload = {
      escola_id: evt.escolaId ?? null,
      portal: evt.portal,
      acao: evt.acao,
      tabela: evt.entity, // 👈 preenche a coluna NOT NULL
      entity: evt.entity, // se existir essa coluna, mantemos também
      entity_id: evt.entityId ?? null,
      details: (evt.details ?? {}) as Json,
    };

    const { error } = await s.from("audit_logs").insert(payload);
    if (error) {
      console.error("recordAuditServer error:", error.message);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("recordAuditServer exception:", message);
  }
}
