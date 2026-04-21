import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserTenants } from "@/lib/getUserTenants";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ redirect?: string }>;

export default async function SelectContextPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await supabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    redirect(`/login${params.redirect ? `?redirect=${encodeURIComponent(params.redirect)}` : ""}`);
  }

  const tenants = await getUserTenants(user.id);
  if (tenants.length <= 1) {
    const single = tenants[0];
    const fallbackRedirect = single ? "/redirect" : "/login?error=no_tenant";
    const withTarget = params.redirect
      ? `${fallbackRedirect}${fallbackRedirect.includes("?") ? "&" : "?"}redirect=${encodeURIComponent(params.redirect)}`
      : fallbackRedirect;
    redirect(withTarget);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section
        style={{
          width: "min(620px, 100%)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          background: "var(--card)",
          padding: 22,
          boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
        }}
      >
        <h1 style={{ margin: "0 0 6px", fontSize: 28 }}>Selecionar contexto</h1>
        <p style={{ margin: "0 0 16px", color: "#475569", fontSize: 14 }}>
          Esta conta possui múltiplos tenants. Escolha o contexto para continuar.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {tenants.map((tenant) => {
            return (
              <form
                key={tenant.tenantId}
                action="/select-context/choose"
                method="POST"
                style={{
                  display: "grid",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <input type="hidden" name="tenantId" value={tenant.tenantId} />
                <input type="hidden" name="redirect_to" value={params.redirect ?? ""} />
                <button
                  type="submit"
                  style={{
                    appearance: "none",
                    border: 0,
                    background: "transparent",
                    textAlign: "left",
                    padding: 0,
                    margin: 0,
                    cursor: "pointer",
                    color: "#0f172a",
                  }}
                >
                  <strong>{tenant.tenantName}</strong>
                </button>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  {tenant.tenantType} · {tenant.role}
                </div>
              </form>
            );
          })}
        </div>
      </section>
    </main>
  );
}
