import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDefaultFormacaoPath } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export default async function FormacaoHomePage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    const appMetadata = (data.user.app_metadata ?? {}) as Record<string, unknown>;
    const userMetadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const role = String(appMetadata.role ?? userMetadata.role ?? "").trim().toLowerCase();
    redirect(getDefaultFormacaoPath(role));
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section
        style={{
          width: "min(700px, 100%)",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: 28,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.7 }}>
          KLASSE Multi-Product
        </p>
        <h1 style={{ margin: "10px 0 8px", fontSize: 34 }}>Formação</h1>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Entrypoint dedicado para operações de formação, com autenticação e backend partilhados.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <Link href="/login" style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 12 }}>
            Entrar
          </Link>
          <Link href="/dashboard" style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 12 }}>
            Abrir dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
