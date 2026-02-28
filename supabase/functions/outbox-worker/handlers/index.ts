// supabase/functions/outbox-worker/handlers/index.ts
import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type OutboxEvent = {
  id: string;
  event_type: string;
  payload: any;
  escola_id: string;
};

export type EventHandler = (
  event: OutboxEvent,
  supabase: SupabaseClient
) => Promise<void>;

/**
 * Handlers para os tipos de eventos do Outbox.
 * Adicione novos handlers aqui seguindo o nome do event_type.
 */
export const HANDLERS: Record<string, EventHandler> = {
  /**
   * Provisão de acesso de usuários após criação de escola/aluno.
   */
  "AUTH_PROVISION_USER": async (event, _supabase) => {
    console.log(`[AUTH_PROVISION_USER] Processando evento ${event.id} para escola ${event.escola_id}`);
    // Futura integração real com Auth Helpers
    await new Promise((resolve) => setTimeout(resolve, 100));
  },

  /**
   * Envio de mensagens via WhatsApp (Ex: Boletos, Matrículas).
   */
  "WHATSAPP_SEND": async (event, _supabase) => {
    console.log(`[WHATSAPP_SEND] Enviando mensagem via evento ${event.id}`);
    // Integração com Twilio ou Similar
    await new Promise((resolve) => setTimeout(resolve, 100));
  },

  /**
   * Envio de Email.
   */
  "EMAIL_SEND": async (event, _supabase) => {
    console.log(`[EMAIL_SEND] Enviando email via evento ${event.id}`);
    // Integração com Resend ou SendGrid
    await new Promise((resolve) => setTimeout(resolve, 100));
  },

  /**
   * Arquivamento de Documento Oficial (Compliance 7 anos).
   * Payload esperado: { source_bucket: string, source_path: string }
   */
  "ARCHIVE_DOCUMENT": async (event, supabase) => {
    const { source_bucket, source_path } = event.payload;
    const target_bucket = "archive-retention";
    const target_path = `${event.escola_id}/${source_path}`;

    console.log(`[ARCHIVE] Movendo ${source_bucket}/${source_path} para ${target_bucket}/${target_path}`);

    // Realiza a cópia entre buckets via storage API do Supabase (Service Role necessária)
    const { error: copyError } = await supabase.storage
      .from(source_bucket)
      .copy(source_path, target_path, { destinationBucket: target_bucket });

    if (copyError) {
      // Se o erro for que o arquivo já existe no destino, ignoramos (idempotência)
      if (copyError.message?.includes("already exists")) {
        console.warn(`[ARCHIVE] Documento já existe no arquivo: ${target_path}`);
        return;
      }
      throw new Error(`Falha ao arquivar documento: ${copyError.message}`);
    }

    console.log(`[ARCHIVE] Sucesso: ${target_path} protegido por 7 anos.`);
  },
};
