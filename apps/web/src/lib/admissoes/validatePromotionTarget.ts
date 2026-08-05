import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type PromotionCandidate = {
  curso_id: string | null;
  classe_id: string | null;
  turno: string | null;
};

type ValidationResult =
  | { ok: true; turma: { id: string; turma_nome: string | null; ano_letivo: number | null; turno: string | null } }
  | { ok: false; code: string; error: string };

function normaliseTurno(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

export async function validatePromotionTarget(
  supabase: SupabaseClient<Database>,
  escolaId: string,
  candidate: PromotionCandidate,
  turmaId: string,
): Promise<ValidationResult> {
  const { data: turma, error: turmaError } = await supabase
    .from("vw_turmas_para_matricula")
    .select("id, turma_nome, curso_id, classe_id, ano_letivo, turno, capacidade_maxima, ocupacao_atual")
    .eq("escola_id", escolaId)
    .eq("id", turmaId)
    .maybeSingle();

  if (turmaError) throw turmaError;
  if (!turma || !turma.id) {
    return { ok: false, code: "PROMOTION_TURMA_NOT_FOUND", error: "Turma oficial não encontrada para esta escola." };
  }
  if (candidate.curso_id && turma.curso_id !== candidate.curso_id) {
    return { ok: false, code: "PROMOTION_COURSE_MISMATCH", error: "A turma escolhida não pertence ao curso de interesse." };
  }
  if (candidate.classe_id && turma.classe_id !== candidate.classe_id) {
    return { ok: false, code: "PROMOTION_CLASS_MISMATCH", error: "A turma escolhida não pertence à classe de interesse." };
  }
  if (normaliseTurno(candidate.turno) && normaliseTurno(turma.turno) !== normaliseTurno(candidate.turno)) {
    return { ok: false, code: "PROMOTION_SHIFT_MISMATCH", error: "A turma escolhida não corresponde ao turno de interesse." };
  }

  const capacidade = Number(turma.capacidade_maxima ?? 0);
  const ocupacao = Number(turma.ocupacao_atual ?? 0);
  if (Number.isFinite(capacidade) && capacidade > 0 && ocupacao >= capacidade) {
    return { ok: false, code: "PROMOTION_NO_VACANCY", error: "A turma escolhida não tem vagas disponíveis." };
  }

  if (turma.curso_id && turma.ano_letivo) {
    let exactPriceQuery = supabase
      .from("financeiro_tabelas")
      .select("valor_matricula")
      .eq("escola_id", escolaId)
      .eq("ano_letivo", turma.ano_letivo)
      .eq("curso_id", turma.curso_id);
    exactPriceQuery = turma.classe_id
      ? exactPriceQuery.eq("classe_id", turma.classe_id)
      : exactPriceQuery.is("classe_id", null);
    const { data: exactPrice } = await exactPriceQuery.maybeSingle();

    const price = Number(exactPrice?.valor_matricula ?? 0);
    if (!Number.isFinite(price) || price <= 0) {
      const { data: coursePrice } = await supabase
        .from("financeiro_tabelas")
        .select("valor_matricula")
        .eq("escola_id", escolaId)
        .eq("ano_letivo", turma.ano_letivo)
        .eq("curso_id", turma.curso_id)
        .is("classe_id", null)
        .maybeSingle();
      const fallbackPrice = Number(coursePrice?.valor_matricula ?? 0);
      if (!Number.isFinite(fallbackPrice) || fallbackPrice <= 0) {
        return { ok: false, code: "PROMOTION_PRICE_MISSING", error: "Não existe preço de matrícula configurado para o ano e a turma escolhidos." };
      }
    }
  }

  return {
    ok: true,
    turma: {
      id: turma.id,
      turma_nome: turma.turma_nome,
      ano_letivo: turma.ano_letivo,
      turno: turma.turno,
    },
  };
}
