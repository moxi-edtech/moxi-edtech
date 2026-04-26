"use server";

import { createClient } from "@supabase/supabase-js";
import { checkoutSchema } from "@/lib/validations/checkoutSchema";

type SubmitCheckoutPayload = {
  centro_slug: string;
  cohort_ref: string;
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

  const centroSlug = payload.centro_slug.trim().toLowerCase();
  const cohortRef = payload.cohort_ref.trim();
  if (!centroSlug || !cohortRef) {
    return { ok: false, error: "Destino da inscrição inválido." };
  }

  const resolver = supabase as typeof supabase & {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const { data: targetData, error: targetError } = await resolver.rpc(
    "formacao_self_service_resolve_target",
    {
      p_escola_slug: centroSlug,
      p_cohort_ref: cohortRef,
    }
  );

  if (targetError) {
    return { ok: false, error: targetError.message || "Não foi possível resolver turma de destino." };
  }

  const target = Array.isArray(targetData)
    ? (targetData[0] as { escola_id?: string; cohort_id?: string } | undefined)
    : (targetData as { escola_id?: string; cohort_id?: string } | null);
  const escolaId = String(target?.escola_id ?? "").trim();
  const cohortId = String(target?.cohort_id ?? "").trim();
  if (!escolaId || !cohortId) {
    return { ok: false, error: "Turma não encontrada ou indisponível para inscrição pública." };
  }

  const identificacao = validation.data.identificacao.trim();
  const maybeEmail = identificacao.includes("@") ? identificacao : null;
  const biPassaporte = identificacao.includes("@") ? "N/A" : identificacao;

  const { error } = await supabase.from("formacao_inscricoes_staging").insert({
    escola_id: escolaId,
    cohort_id: cohortId,
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
