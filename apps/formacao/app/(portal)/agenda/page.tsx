import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function AgendaFormadorPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formador", "formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0 }}>Agenda do Formador</h1>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Visão de aulas e cohorts atribuídos. Próximo passo: integrar com tabela `formacao_cohort_formadores`.
      </p>

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <p style={{ margin: 0, fontSize: 14 }}>Nenhuma sessão agendada para hoje.</p>
      </section>
    </div>
  );
}
