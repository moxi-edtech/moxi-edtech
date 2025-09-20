 import 'server-only'
 import { createClient } from "@/lib/supabaseClient"

export type AuditEvent = {
  escolaId?: string | null
  portal: 'admin_escola' | 'secretaria' | 'financeiro' | 'aluno' | 'super_admin' | 'outro'
  action: string
  entity: string
  entityId?: string | null
  details?: Record<string, any>
}

export async function recordAuditServer(evt: AuditEvent) {
  const { supabaseServer } = await import("@/lib/supabaseServer")
  const s = (await supabaseServer()) as any
  const { error } = await s.from('audit_logs').insert({
    escola_id: evt.escolaId ?? null,
    portal: evt.portal,
    action: evt.action,
    entity: evt.entity,
    entity_id: evt.entityId ?? null,
    details: evt.details ?? {},
  })
  if (error) {
    // Loga no server mas não explode a requisição consumidora
    console.error('recordAuditServer error:', error.message)
  }
}

export async function recordAuditClient(evt: AuditEvent) {
  const s = createClient() as any
  const { error } = await s.from('audit_logs').insert({
    escola_id: evt.escolaId ?? null,
    portal: evt.portal,
    action: evt.action,
    entity: evt.entity,
    entity_id: evt.entityId ?? null,
    details: evt.details ?? {},
  })
  if (error) {
    // Evita quebrar UX no client
    console.warn('recordAuditClient error:', error.message)
  }
}
