import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section
        style={{
          width: "min(520px, 100%)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          background: "var(--card)",
          padding: 20,
        }}
      >
        <h1 style={{ marginTop: 0 }}>Acesso negado</h1>
        <p style={{ opacity: 0.8 }}>Este papel não tem permissão para aceder a esta área.</p>
        <Link href="/dashboard" style={{ textDecoration: "underline" }}>
          Voltar ao dashboard
        </Link>
      </section>
    </main>
  );
}
