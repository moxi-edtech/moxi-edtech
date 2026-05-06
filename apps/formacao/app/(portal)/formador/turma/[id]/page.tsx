import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import FormadorCohortJournal from "@/components/pedagogico/FormadorCohortJournal";

export const dynamic = "force-dynamic";

export default async function FormadorTurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  // Apenas formadores e admins acessam o diário
  if (!["formador", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  const p = await params;
  return <FormadorCohortJournal cohortId={p.id} />;
}
