"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

type Funcionario = {
  user_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  numero_login: string | null;
  papel: string | null;
  created_at: string | null;
  last_login: string | null;
};

const papelLabels: Record<string, string> = {
  admin: "Administrador",
  staff_admin: "Staff Admin",
  secretaria: "Secretaria",
  financeiro: "Financeiro",
};

export default function FuncionariosPage({ embedded = false }: { embedded?: boolean } = {}) {
  const p = useParams() as Record<string, string | string[] | undefined>;
  const escolaId = useMemo(() => (Array.isArray(p.id) ? p.id[0] : (p.id ?? "")), [p.id]);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!escolaId) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        const res = await fetch(`/api/escolas/${escolaId}/funcionarios?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar funcionários");
        if (active) setItems(json.items || []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Erro ao carregar funcionários");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [escolaId, search]);

  return (
    <div className={`${embedded ? "" : "mx-auto w-full max-w-6xl space-y-6 px-4 py-6"}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserGroupIcon className="w-7 h-7 text-klasse-green" />
          <h1 className="text-3xl font-bold text-klasse-green">Funcionários</h1>
        </div>
        {!embedded && (
          <Link href={`/escola/${escolaId}/funcionarios/novo`}>
            <Button tone="gold">
              <PlusIcon className="w-5 h-5" />
              Novo Funcionário
            </Button>
          </Link>
        )}
      </div>

      {!embedded && (
        <div className="flex border-b border-slate-200">
          {["funcionarios", "novo"].map((tab) => (
            <Link
              key={tab}
              href={
                tab === "novo" ? `/escola/${escolaId}/funcionarios/novo` : `/escola/${escolaId}/funcionarios`
              }
              className={`px-6 py-3 font-medium relative ${
                tab === "funcionarios"
                  ? "text-klasse-gold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab === "novo" ? "Cadastrar" : "Funcionários"}
              {tab === "funcionarios" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-klasse-gold" />
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-klasse-green">Equipe cadastrada</h2>
            <p className="text-sm text-slate-500">Busque por nome, e-mail, telefone ou login.</p>
          </div>
          <div className="relative w-full max-w-sm">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar funcionário"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
            />
          </div>
        </div>

        {loading && <div className="text-sm text-slate-500">Carregando funcionários...</div>}
        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Nenhum funcionário encontrado.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3 text-left">Nome</th>
                  <th className="p-3 text-left">Contato</th>
                  <th className="p-3 text-left">Papel</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.user_id}>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{item.nome || "Sem nome"}</div>
                      <div className="text-xs text-slate-400">
                        Login: {item.numero_login || "—"}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600">
                      <div>{item.email || "—"}</div>
                      <div className="text-xs text-slate-400">{item.telefone || "—"}</div>
                    </td>
                    <td className="p-3 text-slate-600">
                      {item.papel ? (papelLabels[item.papel] || item.papel) : "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          item.last_login
                            ? "bg-klasse-green/10 text-klasse-green"
                            : "bg-klasse-gold/10 text-klasse-gold"
                        }`}
                      >
                        {item.last_login ? (
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                        ) : (
                          <ExclamationCircleIcon className="h-3.5 w-3.5" />
                        )}
                        {item.last_login ? "Ativo" : "Pendente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
