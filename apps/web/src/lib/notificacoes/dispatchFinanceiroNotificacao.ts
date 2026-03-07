import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { buildFinanceiroNotificacao, type FinanceiroNotificacaoKey } from "./financeiro";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type FinanceiroRecipient = {
  user_id: string;
  role: string;
};

type DispatchParams = {
  supabase?: SupabaseClient<Database> | null;
  escolaId: string;
  key: FinanceiroNotificacaoKey;
  params?: {
    alunoNome?: string | null;
    actionUrl?: string | null;
  };
  roles?: string[];
  actorId?: string | null;
  actorRole?: string | null;
  agrupamentoTTLHoras?: number;
};

const FINANCEIRO_ROLES = ["financeiro", "secretaria_financeiro", "admin_financeiro"];

const EVENTO_TIPO_MAP: Record<FinanceiroNotificacaoKey, string> = {
  CATALOGO_PRECOS_ATIVADO: "catalogo.precos.ativado",
  FECHO_AUTORIZADO: "financeiro.fecho.autorizado",
  DESCONTO_APROVADO: "desconto.aprovado",
};

export async function dispatchFinanceiroNotificacao({
  supabase,
  escolaId,
  key,
  params = {},
  roles,
  actorId = null,
  actorRole = null,
  agrupamentoTTLHoras = 24,
}: DispatchParams) {
  const client = supabase ?? getSupabaseServerClient();
  if (!client) {
    console.warn("[dispatchFinanceiroNotificacao] Supabase client indisponível.");
    return { ok: false, reason: "client_unavailable" };
  }

  const payload = buildFinanceiroNotificacao(key, params);

  const targetRoles = roles && roles.length > 0 ? roles : FINANCEIRO_ROLES;
  const { data: recipients, error: recipientsError } = await client.rpc(
    "get_users_by_role",
    {
      p_escola_id: escolaId,
      p_roles: targetRoles as any,
    }
  );

  if (recipientsError) {
    console.error("[dispatchFinanceiroNotificacao] recipients error:", recipientsError.message);
    return { ok: false, reason: "recipients_error" };
  }

  const recipientList = (recipients as FinanceiroRecipient[] | null) ?? [];
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
      entidade_tipo: "notificacao_financeiro",
    })
    .select("id")
    .single();

  if (eventoError || !evento?.id) {
    console.error("[dispatchFinanceiroNotificacao] evento error:", eventoError?.message);
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
    console.error("[dispatchFinanceiroNotificacao] insert error:", insertError.message);
    return { ok: false, reason: "insert_error" };
  }

  return { ok: true, notified: inserts.length };
}
