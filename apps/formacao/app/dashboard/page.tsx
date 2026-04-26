import { redirect } from "next/navigation";
import { getDefaultFormacaoPath, getFormacaoAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await getFormacaoAuthContext();
  if (!auth?.userId) {
    redirect("/login");
  }

  const defaultPath = getDefaultFormacaoPath(auth.role, auth.tenantType);
  if (defaultPath !== "/dashboard") {
    redirect(defaultPath);
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="mt-0 text-3xl font-bold text-zinc-900">Dashboard Formação</h1>
      <p className="text-zinc-600">
        Área inicial do produto Formação. Próxima etapa: migrar módulos operacionais para este app.
      </p>
    </main>
  );
}
