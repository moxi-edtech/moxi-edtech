import ImportacaoDetailPage from "@/app/secretaria/(portal-secretaria)/importacoes/[id]/page";

type Params = {
  id: string;
  importacaoId: string;
};

export default async function ImportacaoDetailEscolaPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { importacaoId } = await params;

  return ImportacaoDetailPage({
    params: Promise.resolve({ id: importacaoId }),
  });
}
