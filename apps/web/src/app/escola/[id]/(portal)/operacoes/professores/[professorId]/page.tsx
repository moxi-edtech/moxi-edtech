import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; professorId: string }>;
}) {
  const { id } = await params;
  return redirect(`/escola/${id}/professores`);
}
