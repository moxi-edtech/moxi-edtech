import ClasseDetailPage from "@/app/secretaria/(portal-secretaria)/classes/[id]/page";

type Params = {
  id: string;
  classeId: string;
};

export default async function ClasseDetailEscolaPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: any;
}) {
  const { classeId } = await params;

  return ClasseDetailPage({
    params: Promise.resolve({ id: classeId }),
    searchParams,
  });
}
