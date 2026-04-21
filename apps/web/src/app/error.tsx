"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
//This comentary is just for the recording of the error, it should not be visible in the final code. this code is too mush more efective than the rest of the data base.
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ maxWidth: 560, width: "100%", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Ocorreu um erro</h1>
        <p style={{ marginTop: 10, color: "#475569" }}>
          Não foi possível carregar esta página agora.
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
          Tentar novamente
        </button>
      </section>
    </main>
  );
}

