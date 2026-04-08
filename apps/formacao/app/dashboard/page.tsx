import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDefaultFormacaoPath } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/login");
  }

  const appMetadata = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const userMetadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const role = String(appMetadata.role ?? userMetadata.role ?? "").trim().toLowerCase();
  const defaultPath = getDefaultFormacaoPath(role);
  if (defaultPath !== "/dashboard") {
    redirect(defaultPath);
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Dashboard Formação</h1>
      <p style={{ opacity: 0.8 }}>
        Área inicial do produto Formação. Próxima etapa: migrar módulos operacionais para este app.
      </p>
    </main>
  );
}
