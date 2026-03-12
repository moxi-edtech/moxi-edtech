import TurmaDetailPage from "@/app/secretaria/(portal-secretaria)/turmas/[id]/page";

type Params = {
  id: string;
  turmaId: string;
};

export default async function TurmaDetailEscolaPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { turmaId } = await params;

  return TurmaDetailPage({ params: Promise.resolve({ id: turmaId }) });
}
