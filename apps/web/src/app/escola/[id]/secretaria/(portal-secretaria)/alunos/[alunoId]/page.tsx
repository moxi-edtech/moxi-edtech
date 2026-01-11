import AlunoDossierPage from "@/app/secretaria/(portal-secretaria)/alunos/[id]/page";

type Params = {
  id: string;
  alunoId: string;
};

export default async function AlunoDossierEscolaPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { alunoId } = await params;

  return AlunoDossierPage({ params: Promise.resolve({ id: alunoId }) });
}
