import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

import { normalizeAnoLetivo } from "./tabela-preco";
import { applyKf2ListInvariants } from "@/lib/kf2";

export type MissingPricingItem = {
  curso_id: string | null;
  classe_id: string | null;
  curso_nome: string | null;
  classe_nome: string | null;
  missing_type: "sem_configuracao" | "valores_zerados" | "mensalidade_zero" | "matricula_zero";
};

type CursoRow = Database["public"]["Tables"]["cursos"]["Row"];
type ClasseRow = Database["public"]["Tables"]["classes"]["Row"];
type FinanceiroTabelaRow = Database["public"]["Tables"]["financeiro_tabelas"]["Row"];

type ClasseComCurso = Pick<ClasseRow, "id" | "nome"> & {
  curso: Pick<CursoRow, "id" | "nome" | "escola_id"> | null;
};

export async function findClassesSemPreco(
  client: SupabaseClient<Database>,
  escolaId: string,
  anoLetivoInput: number | string | null | undefined
): Promise<{ anoLetivo: number; items: MissingPricingItem[] }> {
  const anoLetivo = normalizeAnoLetivo(anoLetivoInput);

  let classesQuery = client
    .from("classes")
    .select("id, nome, curso:curso_id(id, nome, escola_id)")
    .eq("escola_id", escolaId);
  classesQuery = applyKf2ListInvariants(classesQuery, { defaultLimit: 2000 });

  const { data: classes, error: classesError } = await classesQuery;

  if (classesError) throw classesError;

  let tabelasQuery = client
    .from("financeiro_tabelas")
    .select("curso_id, classe_id, valor_matricula, valor_mensalidade")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo);
  tabelasQuery = applyKf2ListInvariants(tabelasQuery, { defaultLimit: 2000 });

  const { data: tabelas, error: tabelasError } = await tabelasQuery;

  if (tabelasError) throw tabelasError;

  const tabelasMap = new Map<string, { valor_matricula: number | null; valor_mensalidade: number | null }>();

  (tabelas || []).forEach((t: Pick<FinanceiroTabelaRow, "curso_id" | "classe_id" | "valor_matricula" | "valor_mensalidade">) => {
    const key = `${t.curso_id ?? ""}::${t.classe_id ?? ""}`;
    tabelasMap.set(key, {
      valor_matricula: t.valor_matricula ?? null,
      valor_mensalidade: t.valor_mensalidade ?? null,
    });
  });

  const items: MissingPricingItem[] = [];

  (classes || []).forEach((cls: ClasseComCurso) => {
    const curso = cls.curso;
    if (!curso || curso.escola_id !== escolaId) return;

    const tabela = tabelasMap.get(`${curso.id ?? ""}::${cls.id ?? ""}`);

    const valorMatricula = Number(tabela?.valor_matricula ?? 0);
    const valorMensalidade = Number(tabela?.valor_mensalidade ?? 0);

    let missing_type: MissingPricingItem["missing_type"] | null = null;

    if (!tabela) missing_type = "sem_configuracao";
    else if (valorMatricula <= 0 && valorMensalidade <= 0) missing_type = "valores_zerados";
    else if (valorMensalidade <= 0) missing_type = "mensalidade_zero";
    else if (valorMatricula <= 0) missing_type = "matricula_zero";

    if (missing_type) {
      items.push({
        curso_id: curso.id ?? null,
        classe_id: cls.id ?? null,
        curso_nome: curso.nome ?? null,
        classe_nome: cls.nome ?? null,
        missing_type,
      });
    }
  });

  return { anoLetivo, items };
}
