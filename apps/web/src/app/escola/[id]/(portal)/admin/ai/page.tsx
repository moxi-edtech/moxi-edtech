import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminAiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/escola/${id}/admin/ai/actions`);
}
