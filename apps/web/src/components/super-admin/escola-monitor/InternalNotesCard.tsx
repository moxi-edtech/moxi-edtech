"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type InternalNotesCardProps = {
  escolaId: string;
};

export function InternalNotesCard({ escolaId }: InternalNotesCardProps) {
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/super-admin/escolas/${escolaId}/notes`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Falha ao carregar notas");
        }
        setNota(json.nota ?? "");
        setLastUpdated(json.updated_at ?? null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar";
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [escolaId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/super-admin/escolas/${escolaId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao salvar notas");
      }
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas Internas</CardTitle>
        <CardDescription>Apontamentos visíveis apenas no Super Admin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        <textarea
          className="w-full min-h-[160px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
          placeholder={loading ? "Carregando notas..." : "Escreva aqui o contexto desta escola"}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          disabled={loading || saving}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-slate-500">
            {lastUpdated ? `Atualizado em ${new Date(lastUpdated).toLocaleString("pt-AO")}` : "Ainda sem notas"}
          </span>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? "A guardar..." : "Guardar notas"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
