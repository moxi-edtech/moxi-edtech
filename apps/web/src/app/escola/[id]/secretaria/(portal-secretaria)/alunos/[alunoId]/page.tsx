import AlunoDossierPage from "@/app/secretaria/(portal-secretaria)/alunos/[id]/page";

export default function AlunoDossierEscolaPage({ params }: { params: { alunoId: string } }) {
  return AlunoDossierPage({ params: Promise.resolve({ id: params.alunoId }) });
}
