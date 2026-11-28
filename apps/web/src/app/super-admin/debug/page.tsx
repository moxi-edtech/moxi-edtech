"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

type DebugPayload = {
  ok: boolean;
  env: { hasUrl: boolean; hasAnonKey: boolean };
  cookies: { names: string[] };
  session: { expires_at: number | null; expires_in: number | null } | null;
  user: { id: string; email: string | null; role: string | null; escola_id: string | null } | null;
  errors: { sessionError: string | null; userError: string | null };
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-border">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg shadow p-4">
      <h2 className="font-semibold text-foreground mb-3">{title}</h2>
      {children}
    </div>
  );
}

function SessionDebug() {
  const [data, setData] = useState<DebugPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/debug/session");
      const json = (await res.json()) as DebugPayload;
      if (!res.ok || !json.ok) throw new Error("Falha ao obter sessão");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const jsonStr = useMemo(() => JSON.stringify(data, null, 2), [data]);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Debug de Sessão</h1>
        <div className="flex gap-2">
          <Button onClick={load} tone="teal" size="sm">Recarregar</Button>
          <a
            href="/api/health"
            target="_blank"
            className="px-3 py-2 bg-muted text-foreground rounded hover:bg-muted"
          >
            /api/health
          </a>
          <a href="/super-admin/debug/email-preview" className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">Preview de Email</a>
        </div>
      </div>

      {loading && <div>Carregando…</div>}
      {error && <div className="text-red-600">Erro: {error}</div>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Ambiente">
            <Row label="hasUrl" value={String(data.env.hasUrl)} />
            <Row label="hasAnonKey" value={String(data.env.hasAnonKey)} />
          </Section>
          <Section title="Cookies">
            <div className="font-mono text-sm text-foreground break-words">
              {data.cookies.names.length ? data.cookies.names.join(", ") : "(nenhum)"}
            </div>
          </Section>
          <Section title="Sessão">
            <Row label="expires_at" value={String(data.session?.expires_at ?? null)} />
            <Row label="expires_in" value={String(data.session?.expires_in ?? null)} />
          </Section>
          <Section title="Usuário">
            <Row label="id" value={String(data.user?.id ?? "-")} />
            <Row label="email" value={String(data.user?.email ?? "-")} />
            <Row label="role" value={String(data.user?.role ?? "-")} />
            <Row label="escola_id" value={String(data.user?.escola_id ?? "-")} />
          </Section>
          <Section title="Erros">
            <Row label="sessionError" value={String(data.errors.sessionError ?? "-")} />
            <Row label="userError" value={String(data.errors.userError ?? "-")} />
          </Section>
          <Section title="Payload bruto">
            <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-96">{jsonStr}</pre>
          </Section>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <SessionDebug />;
}
