"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt">
      <body style={{ margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ maxWidth: 560, width: "100%", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Falha crítica de renderização</h1>
            <p style={{ marginTop: 10, color: "#475569" }}>
              Ocorreu um erro inesperado na aplicação.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 14,
                border: 0,
                borderRadius: 8,
                padding: "10px 14px",
                background: "#1f6b3b",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Recarregar
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

