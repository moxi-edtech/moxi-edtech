import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function PagamentosFormacaoPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (
    ![
      "formando",
      "formacao_financeiro",
      "formacao_admin",
      "super_admin",
      "global_admin",
    ].includes(String(auth.role))
  ) {
    redirect("/forbidden");
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0 }}>Pagamentos</h1>
      <p style={{ margin: 0, opacity: 0.78 }}>
        Histórico de cobranças e pagamentos do formando (ou acompanhamento financeiro).
      </p>

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <p style={{ margin: 0, fontSize: 14 }}>Sem pagamentos registrados neste período.</p>
      </section>
    </div>
  );
}
