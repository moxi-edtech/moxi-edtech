import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { buildProfessorNotificacao, type ProfessorNotificacaoKey } from "./professores";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type ProfessorRecipient = {
  user_id: string;
  role: string;
};

type DispatchParams = {
  supabase?: SupabaseClient<Database> | null;
  escolaId: string;
  key: ProfessorNotificacaoKey;
  params?: {
    turmaNome?: string | null;
    alunoNome?: string | null;
    actionUrl?: string | null;
  };
  recipientIds?: string[];
  actorId?: string | null;
  actorRole?: string | null;
  agrupamentoTTLHoras?: number;
};

const PROFESSOR_ROLES = ["professor"];

const EVENTO_TIPO_MAP: Record<ProfessorNotificacaoKey, string> = {
  CURRICULO_PUBLICADO: "curriculo.published",
  ANO_LETIVO_ACTIVADO: "ano_letivo.ativado",
  TURMA_ATRIBUIDA: "turma.atribuida",
  ALUNO_MATRICULADO: "matricula.aluno_matriculado",
  ALUNO_TRANSFERIDO: "matricula.aluno_transferido",
  ALUNO_CANCELADO: "matricula.aluno_cancelado",
  ALUNO_REINTEGRADO: "matricula.aluno_reintegrado",
  PRAZO_NOTAS_3D: "notas.prazo_3d",
  PRAZO_NOTAS_EXPIRADO: "notas.prazo_expirado",
};

export async function dispatchProfessorNotificacao({
  supabase,
  escolaId,
  key,
  params = {},
  recipientIds,
  actorId = null,
  actorRole = null,
  agrupamentoTTLHoras = 24,
}: DispatchParams) {
  const client = supabase ?? getSupabaseServerClient();
  if (!client) {
    console.warn("[dispatchProfessorNotificacao] Supabase client indisponível.");
    return { ok: false, reason: "client_unavailable" };
  }

  const payload = buildProfessorNotificacao(key, params);

  let recipientList: Array<{ user_id: string }> = [];
  if (recipientIds && recipientIds.length > 0) {
    recipientList = recipientIds.map((id) => ({ user_id: id }));
  } else {
    const { data: recipients, error: recipientsError } = await client.rpc(
      "get_users_by_role",
      {
        p_escola_id: escolaId,
        p_roles: PROFESSOR_ROLES as any,
      }
    );

    if (recipientsError) {
      console.error("[dispatchProfessorNotificacao] recipients error:", recipientsError.message);
      return { ok: false, reason: "recipients_error" };
    }
    recipientList = (recipients as ProfessorRecipient[] | null) ?? [];
  }

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
      entidade_tipo: "notificacao_professor",
    })
    .select("id")
    .single();

  if (eventoError || !evento?.id) {
    console.error("[dispatchProfessorNotificacao] evento error:", eventoError?.message);
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
    console.error("[dispatchProfessorNotificacao] insert error:", insertError.message);
    return { ok: false, reason: "insert_error" };
  }

  return { ok: true, notified: inserts.length };
}
