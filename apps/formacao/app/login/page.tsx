import Link from "next/link";

export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(560px, 100%)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Login Formação</h1>
        <p style={{ opacity: 0.8, marginTop: 0 }}>
          O fluxo de autenticação permanece partilhado com Supabase/Auth único.
        </p>
        <p style={{ marginBottom: 0 }}>
          Use o fluxo central em <Link href="https://app.klasse.ao/login">app.klasse.ao/login</Link> até a tela dedicada ser migrada.
        </p>
      </section>
    </main>
  );
}
