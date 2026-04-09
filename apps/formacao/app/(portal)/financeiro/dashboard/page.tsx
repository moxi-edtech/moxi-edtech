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
    <div className="grid gap-3">
      <h1 className="m-0 text-3xl font-bold text-zinc-900">Financeiro Centro</h1>
      <p className="m-0 text-zinc-600">
        Módulo financeiro dedicado de Formação em construção. Esta área já está protegida por papel.
      </p>
    </div>
  );
}
