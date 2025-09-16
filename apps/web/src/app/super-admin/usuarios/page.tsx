// apps/web/src/app/super-admin/usuarios/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";
import { createClient } from "@/lib/supabaseClient";
import type { Database } from "~types/supabase";

type Usuario = {
  id: string;
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
  const supabase = createClient();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsuarios = async () => {
      setLoading(true);

      // 1) Profiles básicos
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, nome, email, telefone, role")
        .order("nome", { ascending: true });

      if (!error && profiles) {
        type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "user_id" | "nome" | "email" | "telefone" | "role">
        const pRows = profiles as ProfileRow[]

        // 2) Vínculos escola_usuarios para esses users
        const userIds = pRows.map(p => p.user_id)
        const { data: vincs } = await supabase
          .from("escola_usuarios")
          .select("user_id, escola_id, papel")
          .in("user_id", userIds)

        type VincRow = { user_id: string; escola_id: string; papel: string | null }
        const vRows = (vincs ?? []) as VincRow[]

        // 3) Nomes de escolas
        const escolaIds = Array.from(new Set(vRows.map(v => v.escola_id)))
        let escolasMap = new Map<string, string | null>()
        if (escolaIds.length) {
          const { data: escolas } = await supabase
            .from("escolas")
            .select("id, nome")
            .in("id", escolaIds)
          escolasMap = new Map((escolas ?? []).map((e: { id: string; nome: string | null }) => [e.id, e.nome]))
        }

        const normalizados: Usuario[] = pRows.map(u => {
          const vinc = vRows.find(v => v.user_id === u.user_id)
          const escolaNome = vinc ? escolasMap.get(vinc.escola_id) ?? null : null
          const papelEscola = vinc?.papel ?? null
          return {
            id: u.user_id,
            nome: u.nome ?? null,
            email: u.email ?? "",
            telefone: u.telefone ?? null,
            role: (u.role as unknown as string) ?? "",
            escola_nome: escolaNome,
            papel_escola: papelEscola,
          }
        })
        setUsuarios(normalizados)
      }

      setLoading(false);
    };

    fetchUsuarios();
  }, [supabase]);

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
                <td colSpan={6} className="py-6 text-center text-gray-500">
                  Carregando usuários...
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-moxinexa-light/5">
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
