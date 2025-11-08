"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";
// Supabase client not required here; data comes via API route

type Usuario = {
  id: string;
  numero_login: string | null;
  nome: string | null;
  email: string;
  telefone: string | null;
  role: string;
  escola_nome: string | null;
  papel_escola: string | null;
};

export default function Page() {
  return (
    <RequireSuperAdmin>
      <ListaUsuarios />
    </RequireSuperAdmin>
  );
}

function ListaUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/super-admin/users/list', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || 'Falha ao carregar usuários');
        setUsuarios(json.items as Usuario[]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setUsuarios([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsuarios();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Usuários Globais</h1>
        <Link
          href="/super-admin/usuarios/novo"
          className="px-4 py-2 rounded-lg bg-moxinexa-teal text-white hover:bg-moxinexa-teal-dark"
        >
          + Novo Usuário
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow border border-moxinexa-light/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-moxinexa-light/10">
            <tr>
              <th className="py-3 px-4 text-left">ID</th>
              <th className="py-3 px-4 text-left">Número Login</th>
              <th className="py-3 px-4 text-left">Nome</th>
              <th className="py-3 px-4 text-left">Email</th>
              <th className="py-3 px-4 text-left">Telefone</th>
              <th className="py-3 px-4 text-left">Papel Global</th>
              <th className="py-3 px-4 text-left">Escola</th>
              <th className="py-3 px-4 text-left">Função na Escola</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-moxinexa-light/20">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-gray-500">
                  Carregando usuários...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-red-600">
                  Erro ao carregar: {error}
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-gray-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-moxinexa-light/5">
                  <td className="py-3 px-4 font-mono text-xs text-gray-600">
                    {u.id}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-blue-600">
                    {u.numero_login ?? "—"}
                  </td>
                  <td className="py-3 px-4">{u.nome ?? "—"}</td>
                  <td className="py-3 px-4">{u.email}</td>
                  <td className="py-3 px-4">{u.telefone ?? "—"}</td>
                  <td className="py-3 px-4 capitalize">{u.role}</td>
                  <td className="py-3 px-4">{u.escola_nome ?? "—"}</td>
                  <td className="py-3 px-4">{u.papel_escola ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
