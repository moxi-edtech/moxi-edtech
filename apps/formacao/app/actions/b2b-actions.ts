"use server";

import { revalidatePath } from "next/cache";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { supabaseServer } from "@/lib/supabaseServer";
import { randomBytes } from "crypto";

export async function registarVendaB2BAction(formData: FormData) {
  const auth = await getFormacaoAuthContext();
  if (!auth || !auth.escolaId) return { error: "Não autorizado" };

  const empresaNome = formData.get("empresa_nome") as string;
  const nif = formData.get("nif") as string;
  const vagas = parseInt(formData.get("vagas") as string);
  const cohortId = formData.get("cohort_id") as string;
  const valorTotal = parseFloat(formData.get("valor_total") as string);
  const faturaExterna = formData.get("fatura_externa_ref") as string;

  if (!empresaNome || !vagas || !cohortId) return { error: "Dados incompletos" };

  const s = await supabaseServer();

  try {
    // Gerar Token Mágico amigável (slug da empresa + hash)
    const token = `${empresaNome.toLowerCase().replace(/\s+/g, '-')}-${randomBytes(3).toString('hex')}`;

    // Criar o Contrato Desacoplado
    const { data: contrato, error: err } = await s
      .from("formacao_contratos_b2b")
      .insert({
        escola_id: auth.escolaId,
        cohort_id: cohortId,
        empresa_nome: empresaNome,
        empresa_nif: nif,
        vagas_compradas: vagas,
        valor_total: valorTotal,
        fatura_externa_ref: faturaExterna,
        b2b_token: token,
        status: "AGUARDA_PAGAMENTO"
      })
      .select("id")
      .single();

    if (err) throw err;

    revalidatePath("/admin/dashboard");
    revalidatePath("/mentor/dashboard");
    return { 
      success: true, 
      message: "Venda B2B registada. O link mágico será ativado após a confirmação do pagamento.",
      contrato_id: contrato.id
    };
  } catch (err: any) {
    return { error: err.message };
  }
}
