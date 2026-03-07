import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { buildAlunoNotificacao, type AlunoNotificacaoKey } from "./alunos";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type DispatchParams = {
  supabase?: SupabaseClient<Database> | null;
  escolaId: string;
  key: AlunoNotificacaoKey;
  alunoIds: string[];
  params?: {
    alunoNome?: string | null;
    dias?: number;
    disciplinaNome?: string | null;
    faltas?: number | null;
    actionUrl?: string | null;
  };
  actorId?: string | null;
  actorRole?: string | null;
  agrupamentoTTLHoras?: number;
};

const EVENTO_TIPO_MAP: Record<AlunoNotificacaoKey, string> = {
  MATRICULA_CONFIRMADA: "matricula.confirmada",
  DOCUMENTO_EMITIDO: "documento.emitido",
  NOTA_LANCADA: "nota.lancada",
  AVALIACAO_MARCADA: "avaliacao.marcada",
  FALTA_REGISTADA: "frequencia.falta_registada",
  FALTAS_LIMITE: "frequencia.faltas_limite",
  NOTA_BAIXA: "nota.abaixo_media",
  RENOVACAO_DISPONIVEL: "matricula.renovacao_disponivel",
  PROPINA_ATRASO: "propina.atraso",
  PROPINA_VENCE_3D: "propina.vence_3d",
};

export async function dispatchAlunoNotificacao({
  supabase,
  escolaId,
  key,
  alunoIds,
  params = {},
  actorId = null,
  actorRole = null,
  agrupamentoTTLHoras = 24,
}: DispatchParams) {
  const client = supabase ?? getSupabaseServerClient();
  if (!client) {
    console.warn("[dispatchAlunoNotificacao] Supabase client indisponível.");
    return { ok: false, reason: "client_unavailable" };
  }

  if (!alunoIds.length) {
    return { ok: true, notified: 0 };
  }

  const payload = buildAlunoNotificacao(key, params);

  const { data: alunosRows } = await client
    .from("alunos")
    .select("id, profile_id, usuario_auth_id")
    .eq("escola_id", escolaId)
    .in("id", alunoIds);

  const alunoProfileIds = (alunosRows ?? [])
    .flatMap((row) => [row.profile_id, row.usuario_auth_id])
    .filter(Boolean) as string[];

  const { data: links } = await client
    .from("aluno_encarregados")
    .select("aluno_id, encarregado:encarregados(email)")
    .eq("escola_id", escolaId)
    .in("aluno_id", alunoIds);

  const encarregadoEmails = Array.from(
    new Set(
      (links ?? [])
        .map((row: any) => row.encarregado?.email)
        .filter(Boolean)
    )
  ) as string[];

  let encarregadoProfileIds: string[] = [];
  if (encarregadoEmails.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("user_id")
      .in("email", encarregadoEmails)
      .eq("escola_id", escolaId);
    encarregadoProfileIds = (profiles ?? []).map((row) => row.user_id);
  }

  const recipientIds = Array.from(new Set([...alunoProfileIds, ...encarregadoProfileIds]));
  if (recipientIds.length === 0) {
    return { ok: true, notified: 0 };
  }

  let recipientsToNotify = recipientIds;
  if (payload.agrupamento_chave) {
    const since = new Date(Date.now() - agrupamentoTTLHoras * 60 * 60 * 1000).toISOString();
    const { data: existing } = await client
      .from("notificacoes")
      .select("destinatario_id")
      .eq("escola_id", escolaId)
      .eq("agrupamento_chave", payload.agrupamento_chave)
      .eq("arquivada", false)
      .gte("created_at", since)
      .in("destinatario_id", recipientIds);

    const alreadyNotified = new Set(
      (existing ?? []).map((row) => String((row as { destinatario_id: string }).destinatario_id))
    );
    recipientsToNotify = recipientIds.filter((id) => !alreadyNotified.has(String(id)));
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
        aluno_ids: alunoIds,
        ...params,
      },
      actor_id: actorId,
      actor_role: actorRole,
      entidade_tipo: "notificacao_aluno",
    })
    .select("id")
    .single();

  if (eventoError || !evento?.id) {
    console.error("[dispatchAlunoNotificacao] evento error:", eventoError?.message);
    return { ok: false, reason: "evento_error" };
  }

  const inserts = recipientsToNotify.map((recipientId) => ({
    escola_id: escolaId,
    evento_id: evento.id,
    destinatario_id: recipientId,
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
    console.error("[dispatchAlunoNotificacao] insert error:", insertError.message);
    return { ok: false, reason: "insert_error" };
  }

  return { ok: true, notified: inserts.length };
}
