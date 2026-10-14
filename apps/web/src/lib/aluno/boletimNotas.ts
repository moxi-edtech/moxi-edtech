import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type NotaDb = {
  valor: number | null;
  avaliacao: { nome: string | null; tipo: string | null; trimestre: number | null; turma_disciplina_id: string | null } | null;
};
type TurmaDisciplinaDb = {
  id: string;
  curso_matriz: { disciplina_id: string | null; disciplinas_catalogo: { nome: string | null } | null } | null;
};

export type AvaliacaoPublicada = { nome: string; tipo: string; nota: number; trimestre: number };
export type DisciplinaBoletim = { id: string; nome: string; avaliacoes: AvaliacaoPublicada[] };

export function organizarNotasLancadas(notas: NotaDb[], turmaDisciplinas: TurmaDisciplinaDb[]): DisciplinaBoletim[] {
  const porTurmaDisciplina = new Map(turmaDisciplinas.map((td) => [td.id, td]));
  const disciplinas = new Map<string, DisciplinaBoletim>();
  for (const nota of notas) {
    if (nota.valor === null || !Number.isFinite(Number(nota.valor))) continue;
    const avaliacao = nota.avaliacao;
    if (!avaliacao?.turma_disciplina_id || !avaliacao.trimestre || avaliacao.trimestre < 1 || avaliacao.trimestre > 3) continue;
    const td = porTurmaDisciplina.get(avaliacao.turma_disciplina_id);
    const id = td?.curso_matriz?.disciplina_id;
    if (!id) continue;
    const disciplina = disciplinas.get(id) ?? {
      id,
      nome: td?.curso_matriz?.disciplinas_catalogo?.nome || "Disciplina",
      avaliacoes: [],
    };
    disciplina.avaliacoes.push({
      nome: avaliacao.nome || avaliacao.tipo || "Avaliação",
      tipo: avaliacao.tipo || avaliacao.nome || "Avaliação",
      nota: Number(nota.valor),
      trimestre: avaliacao.trimestre,
    });
    disciplinas.set(id, disciplina);
  }
  return [...disciplinas.values()]
    .map((disciplina) => ({ ...disciplina, avaliacoes: disciplina.avaliacoes.sort((a, b) => a.trimestre - b.trimestre || a.nome.localeCompare(b.nome)) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

// Consultar as notas efectivamente lançadas, não a MV do boletim (actualizada por cron).
export async function loadNotasLancadas(
  supabase: SupabaseClient<Database>,
  scope: { escolaId: string; matriculaId: string; turmaId: string },
): Promise<DisciplinaBoletim[]> {
  const [notasResult, turmaResult] = await Promise.all([
    supabase.from("notas")
      .select("valor, avaliacao:avaliacoes(nome, tipo, trimestre, turma_disciplina_id)")
      .eq("escola_id", scope.escolaId)
      .eq("matricula_id", scope.matriculaId)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("turma_disciplinas")
      .select("id, curso_matriz:curso_matriz_id(disciplina_id, disciplinas_catalogo:disciplina_id(nome))")
      .eq("escola_id", scope.escolaId)
      .eq("turma_id", scope.turmaId)
      .limit(250),
  ]);
  if (notasResult.error || turmaResult.error) throw new Error("Não foi possível consultar as notas lançadas.");
  return organizarNotasLancadas(
    (notasResult.data ?? []) as unknown as NotaDb[],
    (turmaResult.data ?? []) as unknown as TurmaDisciplinaDb[],
  );
}
