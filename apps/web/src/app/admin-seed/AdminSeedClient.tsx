"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface SeedResult {
  ok: boolean;
  message: string;
  userId?: string;
  error?: string;
}

export default function AdminSeedClient() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/seed-superadmin");
      const data = await res.json();

      if (typeof data.ok === "boolean" && typeof data.message === "string") {
        setResult(data as SeedResult);
      } else {
        throw new Error("Resposta da API em formato inválido");
      }
    } catch (err) {
      setResult({
        ok: false,
        message: "Erro ao conectar com a API",
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded-lg">
      <h1 className="text-xl font-bold mb-4">🚀 Seed Super Admin</h1>

      <Button onClick={handleSeed} disabled={loading} tone="blue">
        {loading ? "Processando..." : "Criar/Resetar Super Admin"}
      </Button>

      {result && (
        <div className="mt-4 p-3 border rounded bg-gray-50 text-sm">
          {!result.ok ? (
            <p className="text-red-600">❌ {result.message}</p>
          ) : (
            <p className="text-green-700">
              ✅ {result.message}
              {result.userId && <span className="block">ID: {result.userId}</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
