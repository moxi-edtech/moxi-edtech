"use server";

import { revalidatePath } from "next/cache";
import { mentoriaSchema, type MentoriaInput } from "@/lib/validations/mentoria";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { logFunnelEvent } from "@/lib/funnel-log";

export async function criarMentoriaAction(data: MentoriaInput) {
  const auth = await getFormacaoAuthContext();
  if (!auth?.escolaId) return { error: "Não autorizado" };
  const escolaId = auth.escolaId;

  const validation = mentoriaSchema.safeParse(data);
  if (!validation.success) {
    return { error: "Dados do formulário inválidos" };
  }

  const s = (await supabaseServer()) as FormacaoSupabaseClient;

  try {
    // 1. Criar o "Curso" (A Mentoria em si)
    const cursoCodigo = `MNT-${Date.now().toString().slice(-6)}`;
    const { data: curso, error: cursoErr } = await s
      .from("formacao_cursos")
      .insert({
        escola_id: escolaId,
        codigo: cursoCodigo,
        nome: data.nome,
        modalidade: data.modalidade.toLowerCase(),
        status: "ativo",
      })
      .select("id")
      .single();

    if (cursoErr) throw cursoErr;

    // 2. Criar a "Turma" (O evento/cohort com data e modalidade)
    const cohortCodigo = `MNT-${Date.now().toString().slice(-4)}`;
    const { data: cohort, error: cohortErr } = await s
      .from("formacao_cohorts")
      .insert({
        escola_id: escolaId,
        nome: data.nome,
        codigo: cohortCodigo,
        data_inicio: data.data_inicio,
        data_fim: data.data_inicio,
        carga_horaria_total: 1,
        vagas: data.vagas_limite || 9999,
        status: "aberta",
        curso_nome: data.nome,
      })
      .select("id")
      .single();

    if (cohortErr) throw cohortErr;

    // 3. Vincular o Preço (Tabela financeira de referência)
    if (data.preco > 0) {
      await s.from("formacao_cohort_financeiro").insert({
        escola_id: escolaId,
        cohort_id: cohort.id,
        valor_referencia: data.preco,
      });
    }

    revalidatePath("/admin/dashboard");
    revalidatePath("/mentor/dashboard");
    logFunnelEvent({
      event: "mentor_mentoria_submit_success",
      stage: "nova_mentoria",
      tenant_id: escolaId,
      tenant_slug: auth.tenantSlug,
      user_id: auth.userId,
      source: "criarMentoriaAction",
      details: { turma_id: cohort.id, modalidade: data.modalidade, preco: data.preco },
    });
    
    return { 
      success: true, 
      turma_id: cohort.id,
      tenant_slug: auth.tenantSlug
    };
  } catch (err: unknown) {
    logFunnelEvent({
      event: "mentor_mentoria_submit_failed",
      stage: "nova_mentoria",
      tenant_id: escolaId,
      tenant_slug: auth.tenantSlug,
      user_id: auth.userId,
      source: "criarMentoriaAction",
      details: { reason: err instanceof Error ? err.message : "unknown_error" },
    });
    console.error("Erro ao criar mentoria:", err);
    return { error: err instanceof Error ? err.message : "Erro interno ao processar mentoria" };
  }
}
