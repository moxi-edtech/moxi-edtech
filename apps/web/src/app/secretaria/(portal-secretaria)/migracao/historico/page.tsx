"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";

interface HistoricoItem {
  id: string;
  file_name: string | null;
  status: string | null;
  total_rows: number | null;
  imported_rows: number | null;
  error_rows: number | null;
  created_at: string;
  processed_at: string | null;
}

export default function HistoricoImportacao() {
  const [items, setItems] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      const res = await fetch("/api/migracao/historico");
      const payload = await res.json();
      if (res.ok) setItems(payload.items || []);
      setLoading(false);
    }
    carregar();
  }, []);

  if (loading) {
    return <main className="p-6">Carregando histórico…</main>;
  }

  return (
    <main className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Histórico de Importações</h1>
        <p className="text-sm text-muted-foreground">Acompanhe importações recentes e resultados.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle>{item.file_name || "Importação"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Status: {item.status}</p>
              <p>Registos: {item.total_rows}</p>
              <p>Importados: {item.imported_rows ?? "-"}</p>
              <p>Com erro: {item.error_rows ?? "-"}</p>
              <p>Criado: {new Date(item.created_at).toLocaleString()}</p>
              {item.processed_at && <p>Processado: {new Date(item.processed_at).toLocaleString()}</p>}
              <div className="pt-2 flex items-center gap-2">
                <a
                  href={`/secretaria/migracao/alunos?importId=${encodeURIComponent(item.id)}&step=review`}
                  className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  Reabrir Wizard na Revisão
                </a>
                <a
                  href={`/api/migracao/${encodeURIComponent(item.id)}/erros`}
                  className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200"
                >
                  Ver erros
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
