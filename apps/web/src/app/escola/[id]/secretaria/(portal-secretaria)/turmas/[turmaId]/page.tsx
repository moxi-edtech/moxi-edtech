import TurmaDetailPage from "@/app/secretaria/(portal-secretaria)/turmas/[id]/page";

export default function TurmaDetailEscolaPage({ params }: { params: { turmaId: string } }) {
  return TurmaDetailPage({ params: Promise.resolve({ id: params.turmaId }) });
}
