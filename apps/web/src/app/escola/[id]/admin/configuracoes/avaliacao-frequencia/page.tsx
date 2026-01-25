import { use } from "react";
import AvaliacaoFrequenciaClient from "./AvaliacaoFrequenciaClient";

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
