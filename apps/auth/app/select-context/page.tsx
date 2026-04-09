import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionContexts } from "@/lib/session-context";

type SearchParams = Promise<{ redirect?: string }>;

export default async function SelectContextPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const list = await resolveSessionContexts();

  if (!list) {
    redirect(`/login${params.redirect ? `?redirect=${encodeURIComponent(params.redirect)}` : ""}`);
  }

  if (list.contexts.length <= 1) {
    const single = list.contexts[0];
    const fallbackRedirect = single ? `/redirect?tenant_id=${encodeURIComponent(single.tenant_id)}` : "/login";
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
          {list.contexts.map((ctx) => {
            const hrefBase = `/redirect?tenant_id=${encodeURIComponent(ctx.tenant_id)}`;
            const href = params.redirect
              ? `${hrefBase}&redirect=${encodeURIComponent(params.redirect)}`
              : hrefBase;
            return (
              <Link
                key={ctx.tenant_id}
                href={href}
                style={{
                  display: "block",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "12px 14px",
                  textDecoration: "none",
                  color: "#0f172a",
                }}
              >
                <strong>{ctx.tenant_slug ?? ctx.tenant_id}</strong>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  {ctx.tenant_type} · {ctx.user_role}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

