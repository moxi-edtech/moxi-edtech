import EditarAlunoPage from "@/app/secretaria/(portal-secretaria)/alunos/[id]/editar/page";

type Params = {
  id: string;
  alunoId: string;
};

export default async function EditarAlunoEscolaPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { alunoId } = await params;

  return <EditarAlunoPage id={alunoId} />;
}
