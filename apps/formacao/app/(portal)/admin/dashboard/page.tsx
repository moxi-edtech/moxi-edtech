import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function AdminCentroDashboardPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (!["formacao_admin", "super_admin", "global_admin"].includes(String(auth.role))) {
    redirect("/forbidden");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.7 }}>
          Admin Centro
        </p>
        <h1 style={{ margin: "6px 0 0" }}>Dashboard de Gestão</h1>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
        <Card title="Onboarding" value="Pendente" subtitle="Finalizar checklist do centro" />
        <Card title="Cursos" value="0" subtitle="Criar catálogo inicial" />
        <Card title="Cohorts" value="0" subtitle="Abrir primeira edição" />
        <Card title="Equipa" value="2+" subtitle="Admin + Secretaria mínimos" />
      </section>

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Próximas ações</h2>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Configurar dados fiscais do centro (NIPC, regime IVA, MAPTESS).</li>
          <li>Criar catálogo de cursos e abrir cohorts ativos.</li>
          <li>Convidar formadores e validar acessos por papel.</li>
        </ol>
      </section>
    </div>
  );
}

function Card({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <article style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, background: "#fff" }}>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>{title}</p>
      <p style={{ margin: "8px 0 6px", fontSize: 26, fontWeight: 700 }}>{value}</p>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>{subtitle}</p>
    </article>
  );
}
