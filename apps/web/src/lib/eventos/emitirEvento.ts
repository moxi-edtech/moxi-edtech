import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type EventoInput = {
  escola_id: string;
  tipo: string;
  payload?: Record<string, unknown> | null;
  actor_id?: string | null;
  actor_role?: "admin" | "professor" | "secretaria" | "director" | "sistema" | null;
  entidade_tipo?: string | null;
  entidade_id?: string | null;
};

export async function emitirEvento(
  supabase: SupabaseClient<Database>,
  input: EventoInput
) {
  const { error } = await supabase
    .from("eventos")
    .insert({
      escola_id: input.escola_id,
      tipo: input.tipo,
      payload: input.payload ?? {},
      actor_id: input.actor_id ?? null,
      actor_role: input.actor_role ?? null,
      entidade_tipo: input.entidade_tipo ?? null,
      entidade_id: input.entidade_id ?? null,
    } as any);

  if (error) {
    throw error;
  }
}
