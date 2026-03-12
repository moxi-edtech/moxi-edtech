import { redirect } from "next/navigation";

type Params = {
  id: string;
};

export default async function SecretariaDashboardRedirect({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  redirect(`/escola/${id}/secretaria`);
}
