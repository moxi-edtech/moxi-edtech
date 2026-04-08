import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function FinanceiroDashboardPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth) redirect("/login");

  if (
    ![
      "formacao_financeiro",
      "formacao_admin",
      "super_admin",
      "global_admin",
    ].includes(String(auth.role))
  ) {
    redirect("/forbidden");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0 }}>Financeiro Centro</h1>
      <p style={{ margin: 0, opacity: 0.75 }}>
        Módulo financeiro dedicado de Formação em construção. Esta área já está protegida por papel.
      </p>
    </div>
  );
}
