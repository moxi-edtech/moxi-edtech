import ClasseDetailPage from "@/app/secretaria/(portal-secretaria)/classes/[id]/page";

export default function ClasseDetailEscolaPage({
  params,
  searchParams,
}: {
  params: { classeId: string };
  searchParams: any;
}) {
  return ClasseDetailPage({
    params: Promise.resolve({ id: params.classeId }),
    searchParams,
  });
}
