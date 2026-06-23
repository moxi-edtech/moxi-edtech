import { redirect } from "next/navigation";

export default async function OperacoesLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/escola/${id}/operacoes/dashboard`);
}
