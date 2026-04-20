import { redirect } from "next/navigation";

export default async function AdminAvisosIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/escola/${id}/admin/avisos/novo`);
}

