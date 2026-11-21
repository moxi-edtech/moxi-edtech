import AlunoAtividadeRunnerPage from "@/app/(portal-aluno)/aluno/atividades/[id]/page";

/**
 * A rota contextual usa [atividadeId] (e também [id] para a escola).
 * O runner partilhado espera [id] como identificador da actividade.
 */
export default async function EscolaAlunoAtividadePage({
  params,
}: {
  params: Promise<{ id: string; atividadeId: string }>;
}) {
  const { atividadeId } = await params;
  return <AlunoAtividadeRunnerPage params={Promise.resolve({ id: atividadeId })} />;
}
