import type { SupabaseClient } from "@supabase/supabase-js";

interface GateInput {
  escola_id: string;
  curso_id: string;
  ano_letivo: string;
}

type GateErrorCode =
  | "CURSO_NAO_ENCONTRADO"
  | "CURRICULO_NAO_ENCONTRADO"
  | "CURRICULO_NAO_PUBLICADO"
  | "CURRICULO_SEM_DISCIPLINAS";

type GateResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      code: GateErrorCode;
    };

export async function validarCurriculoParaTurma(
  supabase: SupabaseClient,
  { escola_id, curso_id, ano_letivo }: GateInput
): Promise<GateResult> {
  const { data: curso, error: cursoError } = await supabase
    .from("cursos")
    .select("id, nome")
    .eq("id", curso_id)
    .eq("escola_id", escola_id)
    .maybeSingle();

  if (cursoError || !curso) {
    return {
      ok: false,
      error: "Curso não encontrado ou não pertence a esta escola.",
      code: "CURSO_NAO_ENCONTRADO",
    };
  }

  const { data: anoLetivoRow, error: anoLetivoError } = await supabase
    .from("anos_letivos")
    .select("id")
    .eq("escola_id", escola_id)
    .eq("ano", Number(ano_letivo))
    .maybeSingle();

  if (anoLetivoError || !anoLetivoRow?.id) {
    return {
      ok: false,
      error: `O curso "${curso.nome}" não tem currículo configurado para o ano letivo ${ano_letivo}. Configure e publique o currículo antes de criar turmas.`,
      code: "CURRICULO_NAO_ENCONTRADO",
    };
  }

  const { data: curriculo, error: curriculoError } = await supabase
    .from("curso_curriculos")
    .select("id, status")
    .eq("curso_id", curso_id)
    .eq("escola_id", escola_id)
    .eq("ano_letivo_id", anoLetivoRow.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (curriculoError || !curriculo) {
    return {
      ok: false,
      error: `O curso "${curso.nome}" não tem currículo configurado para o ano letivo ${ano_letivo}. Configure e publique o currículo antes de criar turmas.`,
      code: "CURRICULO_NAO_ENCONTRADO",
    };
  }

  if (curriculo.status !== "published") {
    const statusLabel: Record<string, string> = {
      draft: "rascunho",
      archived: "arquivado",
    };
    const label = statusLabel[curriculo.status] ?? curriculo.status;
    return {
      ok: false,
      error: `O currículo do curso "${curso.nome}" está em ${label}. Publique o currículo antes de criar turmas.`,
      code: "CURRICULO_NAO_PUBLICADO",
    };
  }

  const { count, error: matrizError } = await supabase
    .from("curso_matriz")
    .select("id", { count: "exact", head: true })
    .eq("escola_id", escola_id)
    .eq("curso_curriculo_id", curriculo.id);

  if (matrizError) {
    return {
      ok: false,
      error: "Falha ao validar o currículo no servidor. Tente novamente.",
      code: "CURRICULO_SEM_DISCIPLINAS",
    };
  }

  if (!count || count === 0) {
    return {
      ok: false,
      error: `O currículo do curso "${curso.nome}" não tem disciplinas configuradas. Adicione disciplinas antes de criar turmas.`,
      code: "CURRICULO_SEM_DISCIPLINAS",
    };
  }

  return { ok: true };
}
