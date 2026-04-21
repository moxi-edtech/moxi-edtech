import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

type CorporateTokenValidation =
  | { valid: false; error: string }
  | {
      valid: true;
      contratoId: string;
      escolaId: string;
      cohortId: string;
      empresa: string;
    };

export async function validateCorporateToken(token: string): Promise<CorporateTokenValidation> {
  const s = (await supabaseServer()) as FormacaoSupabaseClient;

  // Buscar o contrato que contém o token
  const { data: contrato, error } = await s
    .from("formacao_contratos_b2b")
    .select(`
      id,
      escola_id,
      cohort_id,
      status,
      vagas_compradas,
      vagas_utilizadas,
      empresa_nome
    `)
    .eq("b2b_token", token)
    .single();

  if (error || !contrato) return { valid: false, error: "Link Mágico inválido." };
  
  if (contrato.status !== "PAGO") {
    return { valid: false, error: "O pagamento deste lote corporativo ainda não foi confirmado pela secretaria." };
  }

  if (contrato.vagas_utilizadas >= contrato.vagas_compradas) {
    return { valid: false, error: "Lotação corporativa esgotada. Contacte os seus Recursos Humanos." };
  }

  return { 
    valid: true, 
    contratoId: contrato.id,
    escolaId: contrato.escola_id,
    cohortId: contrato.cohort_id,
    empresa: contrato.empresa_nome
  };
}
