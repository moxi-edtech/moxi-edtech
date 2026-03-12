import AlunoPerfilPage from "@/components/aluno/AlunoPerfilPage";

export default async function Page({ params }: { params: Promise<{ id: string; alunoId: string }> }) {
  const { id, alunoId } = await params;
  return <AlunoPerfilPage escolaId={id} alunoId={alunoId} role="admin" />;
}
