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
    <main className="grid min-h-screen gap-5 p-6 md:grid-cols-[240px_1fr]">
      <aside className="self-start rounded-2xl border border-zinc-200 bg-white p-3.5 md:sticky md:top-4">
        <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
          Portal Formação
        </p>
        <p className="mb-3 text-sm text-zinc-700">
          Papel: <strong>{auth.role ?? "sem papel"}</strong>
        </p>
        <nav className="grid gap-1.5">
          {availableNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-zinc-200 px-2.5 py-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-200 px-2.5 py-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Dashboard Geral
          </Link>
        </nav>
      </aside>

      <section className="min-h-[420px] rounded-2xl border border-zinc-200 bg-white p-5">
        {children}
      </section>
    </main>
  );
}
