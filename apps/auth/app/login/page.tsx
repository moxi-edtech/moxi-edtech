import LoginForm from "./LoginForm";

type SearchParams = Promise<{ redirect?: string }>;

function normalizeReturnTo(raw: string | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return "";
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const redirectTo = normalizeReturnTo(params.redirect);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section
        style={{
          width: "min(460px, 100%)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          background: "var(--card)",
          padding: 22,
          boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>
          KLASSE Auth
        </p>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>Login Central</h1>
        <p style={{ margin: "0 0 16px", color: "#475569", fontSize: 14 }}>
          Sessão única para K12 e Formação.
        </p>

        <LoginForm redirectTo={redirectTo} />
      </section>
    </main>
  );
}
