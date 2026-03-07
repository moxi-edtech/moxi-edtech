import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { buildAdminNotificacao, type AdminNotificacaoKey } from "./admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type AdminRecipient = {
  user_id: string;
  role: string;
};

type DispatchParams = {
  supabase?: SupabaseClient<Database> | null;
  escolaId: string;
  key: AdminNotificacaoKey;
  params?: {
    dias?: number;
    percentual?: number;
    actionUrl?: string | null;
  };
  actorId?: string | null;
  actorRole?: string | null;
  agrupamentoTTLHoras?: number;
};

const ADMIN_ROLES = ["admin", "admin_escola", "staff_admin"];

const EVENTO_TIPO_MAP: Record<AdminNotificacaoKey, string> = {
  MANUTENCAO_PROGRAMADA: "sistema.manutencao",
  NOVA_FUNCIONALIDADE: "sistema.funcionalidade",
  LIMITE_ALUNOS_80: "plano.limite_80",
  LIMITE_ALUNOS_100: "plano.limite_100",
  SUBSCRICAO_EXPIRA_7: "subscricao.expira",
  SUBSCRICAO_EXPIRADA: "subscricao.expirada",
};

export async function dispatchAdminNotificacao({
  supabase,
  escolaId,
  key,
  params = {},
  actorId = null,
  actorRole = null,
  agrupamentoTTLHoras = 24,
}: DispatchParams) {
  const client = supabase ?? getSupabaseServerClient();
  if (!client) {
    console.warn("[dispatchAdminNotificacao] Supabase client indisponível.");
    return { ok: false, reason: "client_unavailable" };
  }

  const payload = buildAdminNotificacao(key, params);

  const { data: recipients, error: recipientsError } = await client.rpc(
    "get_users_by_role",
    {
      p_escola_id: escolaId,
      p_roles: ADMIN_ROLES as any,
    }
  );

  if (recipientsError) {
    console.error("[dispatchAdminNotificacao] recipients error:", recipientsError.message);
    return { ok: false, reason: "recipients_error" };
  }

  const recipientList = (recipients as AdminRecipient[] | null) ?? [];
  if (recipientList.length === 0) {
    return { ok: true, notified: 0 };
  }

  let recipientsToNotify = recipientList;

  if (payload.agrupamento_chave) {
    const since = new Date(Date.now() - agrupamentoTTLHoras * 60 * 60 * 1000).toISOString();
    const { data: existing } = await client
      .from("notificacoes")
      .select("destinatario_id")
      .eq("escola_id", escolaId)
      .eq("agrupamento_chave", payload.agrupamento_chave)
      .eq("arquivada", false)
      .gte("created_at", since)
      .in(
        "destinatario_id",
        recipientList.map((r) => r.user_id)
      );

    const alreadyNotified = new Set(
      (existing ?? []).map((row) => String((row as { destinatario_id: string }).destinatario_id))
    );
    recipientsToNotify = recipientList.filter((r) => !alreadyNotified.has(String(r.user_id)));
  }

  if (recipientsToNotify.length === 0) {
    return { ok: true, notified: 0 };
  }

  const { data: evento, error: eventoError } = await client
    .from("eventos")
    .insert({
      escola_id: escolaId,
      tipo: EVENTO_TIPO_MAP[key] as any,
      payload: {
        key,
        gatilho: payload.gatilho,
        tipo: payload.tipo,
        agrupamento_chave: payload.agrupamento_chave,
        ...params,
      },
      actor_id: actorId,
      actor_role: actorRole,
      entidade_tipo: "notificacao_admin",
    })
    .select("id")
    .single();

  if (eventoError || !evento?.id) {
    console.error("[dispatchAdminNotificacao] evento error:", eventoError?.message);
    return { ok: false, reason: "evento_error" };
  }

  const inserts = recipientsToNotify.map((recipient) => ({
    escola_id: escolaId,
    evento_id: evento.id,
    destinatario_id: recipient.user_id,
    titulo: payload.titulo,
    corpo: payload.corpo ?? null,
    prioridade: payload.prioridade,
    action_label: payload.action_label ?? null,
    action_url: payload.action_url ?? null,
    gatilho: payload.gatilho,
    tipo: payload.tipo,
    modal_id: payload.modal_id ?? null,
    agrupamento_chave: payload.agrupamento_chave ?? null,
  }));

  const { error: insertError } = await client.from("notificacoes").insert(inserts);
  if (insertError) {
    console.error("[dispatchAdminNotificacao] insert error:", insertError.message);
    return { ok: false, reason: "insert_error" };
  }

  return { ok: true, notified: inserts.length };
}
