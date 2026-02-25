import type { SupabaseClient } from "@supabase/supabase-js";

interface GateInput {
  escola_id: string;
  curso_id: string;
  ano_letivo: string;
  classe_id?: string | null;
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
  { escola_id, curso_id, ano_letivo, classe_id }: GateInput
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

  let curriculoQuery = supabase
    .from("curso_curriculos")
    .select("id")
    .eq("curso_id", curso_id)
    .eq("escola_id", escola_id)
    .eq("ano_letivo_id", anoLetivoRow.id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1);

  if (classe_id) {
    curriculoQuery = curriculoQuery.or(`classe_id.is.null,classe_id.eq.${classe_id}`);
  }

  const { data: curriculo, error: curriculoError } = await curriculoQuery.maybeSingle();

  if (curriculoError) {
    return {
      ok: false,
      error: "Falha ao validar publicação do currículo no servidor. Tente novamente.",
      code: "CURRICULO_NAO_PUBLICADO",
    };
  }

  if (!curriculo) {
    return {
      ok: false,
      error: `O curso "${curso.nome}" não tem currículo publicado para o ano letivo ${ano_letivo}. Publique o currículo antes de criar turmas.`,
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
