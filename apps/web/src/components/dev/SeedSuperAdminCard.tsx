// apps/web/src/components/dev/SeedSuperAdminCard.tsx
"use client";

import { useState } from "react";

export default function SeedSuperAdminCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/seed-superadmin");
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro desconhecido");
      setResult(`✅ Criado com sucesso!\nEmail: ${data.email}\nSenha: ${data.password}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setResult(`❌ Erro: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  // 🚨 Só renderiza em dev
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="p-4 border border-dashed border-red-400 rounded-lg bg-red-50">
      <h2 className="text-lg font-semibold text-red-600 mb-2">
        ⚠️ Developer Tool: Seed Super Admin
      </h2>
      <p className="text-sm text-red-500 mb-3">
        Cria/recria o usuário <b>superadmin@moxinexa.com</b> com senha <b>12345678</b>.
      </p>

      <button
        onClick={handleSeed}
        disabled={loading}
        className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
      >
        {loading ? "⏳ Executando..." : "🚀 Rodar Seed"}
      </button>

      {result && (
        <pre className="mt-3 p-2 text-sm bg-gray-900 text-green-400 rounded-md whitespace-pre-wrap">
          {result}
        </pre>
      )}
    </div>
  );
}
