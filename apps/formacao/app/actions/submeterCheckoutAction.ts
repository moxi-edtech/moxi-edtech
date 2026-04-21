"use server";

import { createClient } from "@supabase/supabase-js";
import { checkoutSchema } from "@/lib/validations/checkoutSchema";

type SubmitCheckoutPayload = {
  escola_id: string;
  cohort_id: string;
  nome_completo: string;
  identificacao: string;
  telefone: string;
  comprovativo_url: string;
};

type SubmitCheckoutResult = { ok: true } | { ok: false; error: string };

export async function submeterCheckoutAction(payload: SubmitCheckoutPayload): Promise<SubmitCheckoutResult> {
  const validation = checkoutSchema.safeParse({
    nome_completo: payload.nome_completo,
    identificacao: payload.identificacao,
    telefone: payload.telefone,
    comprovativo_url: payload.comprovativo_url,
  });

  if (!validation.success) {
    return { ok: false, error: "Dados de matrícula inválidos." };
  }

  const supabaseUrl = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = String(
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ).trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: "Configuração Supabase ausente." };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const identificacao = validation.data.identificacao.trim();
  const maybeEmail = identificacao.includes("@") ? identificacao : null;
  const biPassaporte = identificacao.includes("@") ? "N/A" : identificacao;

  const { error } = await supabase.from("formacao_inscricoes_staging").insert({
    escola_id: payload.escola_id,
    cohort_id: payload.cohort_id,
    nome_completo: validation.data.nome_completo,
    bi_passaporte: biPassaporte,
    email: maybeEmail,
    telefone: validation.data.telefone,
    comprovativo_url: validation.data.comprovativo_url,
    status: "PENDENTE",
  });

  if (error) {
    return { ok: false, error: error.message || "Não foi possível concluir a matrícula." };
  }

  return { ok: true };
}

