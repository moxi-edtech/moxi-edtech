import { use } from "react";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default function AvaliacaoFrequenciaRedirect({ params }: Props) {
  const { id } = use(params);
  redirect(`/escola/${id}/admin/configuracoes/avaliacao`);
}
