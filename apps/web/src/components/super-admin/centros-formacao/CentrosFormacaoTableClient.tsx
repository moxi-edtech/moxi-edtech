"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";

type CentroItem = {
  id: string;
  escola_id: string;
  nome: string;
  abrev: string | null;
  status: string;
  plano: string;
  municipio: string | null;
  provincia: string | null;
  email: string | null;
  telefone: string | null;
  capacidade_max: number | null;
  updated_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  ativo: "Activo",
  suspenso: "Suspenso",
  cancelado: "Cancelado",
};

const PLAN_LABEL: Record<string, string> = {
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

export default function CentrosFormacaoTableClient() {
  const [items, setItems] = useState<CentroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/super-admin/centros-formacao/list", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: CentroItem[] }
        | null;

      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error || "Falha ao carregar centros");
      }

      setItems(json.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      return (
        item.nome.toLowerCase().includes(term) ||
        (item.abrev ?? "").toLowerCase().includes(term) ||
        (item.municipio ?? "").toLowerCase().includes(term) ||
        (item.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar por nome, sigla, município ou email"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-klasse-green sm:max-w-md"
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>
            Recarregar
          </Button>
          <Button asChild>
            <Link href="/super-admin/centros-formacao/novo">Novo Centro</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Centro</th>
              <th className="px-4 py-3 font-semibold">Município</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Plano</th>
              <th className="px-4 py-3 font-semibold">Capacidade</th>
              <th className="px-4 py-3 font-semibold">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>
                  A carregar centros...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>
                  Nenhum centro encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const updatedAt = item.updated_at ? new Date(item.updated_at).toLocaleDateString("pt-PT") : "-";
                return (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.nome}</p>
                      <p className="text-xs text-slate-500">
                        {item.abrev ? `${item.abrev} · ` : ""}
                        {item.email || "sem email"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.municipio || "-"}
                      {item.provincia ? `, ${item.provincia}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{STATUS_LABEL[item.status] || item.status}</td>
                    <td className="px-4 py-3 text-slate-700">{PLAN_LABEL[item.plano] || item.plano}</td>
                    <td className="px-4 py-3 text-slate-700">{item.capacidade_max ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{updatedAt}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
