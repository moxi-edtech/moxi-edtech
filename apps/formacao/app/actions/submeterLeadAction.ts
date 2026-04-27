"use server";

import { createClient } from "@supabase/supabase-js";

type LeadPayload = {
  escola_id: string;
  cohort_id: string;
  nome: string;
  telefone: string;
  email?: string;
  origem?: string;
};

export async function submeterLeadAction(payload: LeadPayload) {
  const supabaseUrl = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = String(
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ).trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: "Configuração do servidor indisponível." };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { error } = await supabase.from("formacao_leads").insert({
    escola_id: payload.escola_id,
    cohort_id: payload.cohort_id,
    nome: payload.nome,
    telefone: payload.telefone,
    email: payload.email || null,
    origem: payload.origem || "landing_page_oportunidade",
    status: "NOVO"
  });

  if (error) {
    console.error("Erro ao salvar lead:", error);
    return { ok: false, error: "Não foi possível registar o seu interesse. Tente novamente." };
  }

  return { ok: true };
}
