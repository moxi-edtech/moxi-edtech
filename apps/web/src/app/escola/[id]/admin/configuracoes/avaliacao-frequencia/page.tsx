import { use } from "react";
// Fallback inline component used when the external AvaliacaoFrequenciaClient module is missing
function AvaliacaoFrequenciaClient({ escolaId }: { escolaId: string }) {
  return <div>Configurações de avaliação para escola {escolaId}</div>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

export default function AvaliacaoFrequenciaPage({ params }: Props) {
  const resolvedParams = use(params);
  const escolaId = resolvedParams.id;

  return <AvaliacaoFrequenciaClient escolaId={escolaId} />;
}
