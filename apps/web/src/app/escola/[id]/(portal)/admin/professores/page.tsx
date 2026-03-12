import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfessoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/escola/${id}/professores`);
}
