import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormacaoAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Admin Centro", roles: ["formacao_admin", "super_admin", "global_admin"] },
  { href: "/admin/onboarding", label: "Onboarding", roles: ["formacao_admin", "super_admin", "global_admin"] },
  {
    href: "/secretaria/catalogo-cursos",
    label: "Secretaria Centro",
    roles: ["formacao_admin", "formacao_secretaria", "super_admin", "global_admin"],
  },
  {
    href: "/secretaria/certificados",
    label: "Certificados",
    roles: ["formacao_admin", "formacao_secretaria", "super_admin", "global_admin"],
  },
  {
    href: "/financeiro/dashboard",
    label: "Financeiro Centro",
    roles: ["formacao_admin", "formacao_financeiro", "super_admin", "global_admin"],
  },
  {
    href: "/financeiro/faturacao-b2b",
    label: "Faturação B2B",
    roles: ["formacao_admin", "formacao_financeiro", "super_admin", "global_admin"],
  },
  {
    href: "/financeiro/faturacao-b2c",
    label: "Faturação B2C",
    roles: ["formando", "formacao_admin", "formacao_financeiro", "super_admin", "global_admin"],
  },
  {
    href: "/agenda",
    label: "Agenda Formador",
    roles: ["formador", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    href: "/honorarios",
    label: "Honorários",
    roles: ["formador", "formacao_financeiro", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    href: "/meus-cursos",
    label: "Meus Cursos",
    roles: ["formando", "formacao_admin", "super_admin", "global_admin"],
  },
  {
    href: "/pagamentos",
    label: "Pagamentos",
    roles: ["formando", "formacao_financeiro", "formacao_admin", "super_admin", "global_admin"],
  },
] as const;

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getFormacaoAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.tenantType === "k12") {
    redirect("https://app.klasse.ao");
  }

  const availableNav = NAV_ITEMS.filter((item) => item.roles.includes((auth.role ?? "") as never));

  return (
    <main style={{ minHeight: "100vh", padding: 24, display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
      <aside
        style={{
          border: "1px solid var(--line)",
          borderRadius: 16,
          background: "var(--card)",
          padding: 14,
          alignSelf: "start",
          position: "sticky",
          top: 16,
        }}
      >
        <p style={{ margin: "0 0 8px", fontSize: 12, opacity: 0.65, textTransform: "uppercase", letterSpacing: 1 }}>
          Portal Formação
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 13 }}>
          Papel: <strong>{auth.role ?? "sem papel"}</strong>
        </p>
        <nav style={{ display: "grid", gap: 6 }}>
          {availableNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "9px 10px", fontSize: 14 }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "9px 10px", fontSize: 14 }}
          >
            Dashboard Geral
          </Link>
        </nav>
      </aside>

      <section
        style={{ border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)", padding: 20, minHeight: 420 }}
      >
        {children}
      </section>
    </main>
  );
}
