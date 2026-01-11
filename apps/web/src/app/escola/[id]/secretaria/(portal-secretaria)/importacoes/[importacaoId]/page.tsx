import ImportacaoDetailPage from "@/app/secretaria/(portal-secretaria)/importacoes/[id]/page";

export default function ImportacaoDetailEscolaPage({
  params,
}: {
  params: { importacaoId: string };
}) {
  return ImportacaoDetailPage({
    params: Promise.resolve({ id: params.importacaoId }),
  });
}
