import AlunoPerfilPage from "@/components/aluno/AlunoPerfilPage";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string; alunoId: string }>; searchParams?: Promise<{ ano?: string }> }) {
  const { id, alunoId } = await params;
  const query = searchParams ? await searchParams : {};
  const selectedYear = query.ano && /^\d{4}$/.test(query.ano) ? Number(query.ano) : null;
  return <AlunoPerfilPage escolaId={id} alunoId={alunoId} role="admin" selectedYear={selectedYear} />;
}
