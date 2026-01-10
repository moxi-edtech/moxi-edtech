"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Link from "next/link";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";

type Usuario = {
  id: string;
  numero_login: string | null;
  nome: string | null;
  email: string;
  telefone: string | null;
  role: string;
  escola_nome: string | null;
  papel_escola: string | null;
  escola_id: string | null;
  // 👇 campos opcionais para suportar soft delete / arquivamento
  ativo?: boolean | null;
  status?: string | null;
};

type Escola = {
  id: string;
  nome: string;
};

export default function UsuariosListClient() {
  return (
    <RequireSuperAdmin>
      <ListaUsuarios />
    </RequireSuperAdmin>
  );
}

function ListaUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Usuario>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [usersRes, escolasRes] = await Promise.all([
          fetch("/api/super-admin/users/list", { cache: "force-cache" }),
          fetch("/api/super-admin/escolas/list", { cache: "force-cache" }),
        ]);

        if (!usersRes.ok) throw new Error("Falha ao carregar usuários");
        if (!escolasRes.ok) throw new Error("Falha ao carregar escolas");

        const usersJson = await usersRes.json();
        const escolasJson = await escolasRes.json();

        const escolasArr =
          (escolasJson.items || []) as Array<{ id: string; nome: string | null }>;

        const escolaNameMap = new Map(
          escolasArr.map((e) => [String(e.id), e.nome ?? ""])
        );

        const allUsers = (usersJson.items || []) as Usuario[];

        // 1) remove alunos
        // 2) remove usuários inativos/arquivados/excluídos (soft delete)
        const filteredUsers = allUsers
          .filter((u) => u.papel_escola !== "aluno")
          .filter((u) => {
            // Se tiver campo ativo, só mostra se não for false
            if (u.ativo === false) return false;
            // Se tiver status, esconde arquivados/excluídos
            if (u.status === "arquivado" || u.status === "excluido") return false;
            return true;
          })
          .map((u) => ({
            ...u,
            escola_nome:
              u.escola_nome ??
              (u.escola_id ? escolaNameMap.get(String(u.escola_id)) ?? null : null),
          }));

        setUsuarios(filteredUsers);

        setEscolas(
          escolasArr.map(
            (e) =>
              ({
                id: String(e.id),
                nome: e.nome ?? "",
              }) as Escola
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setUsuarios([]);
        setEscolas([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEdit = (usuario: Usuario) => {
    setEditingId(usuario.id);
    setEditForm({
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      role: usuario.role,
      escola_id: usuario.escola_id,
      papel_escola: usuario.papel_escola,
      numero_login: usuario.numero_login,
    });
  };

  const handleSave = async (usuarioId: string) => {
    try {
      setSaving(usuarioId);
      setError(null);

      const res = await fetch("/api/super-admin/users/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: usuarioId,
          updates: editForm,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.ok) {
        throw new Error(result.error || "Falha ao atualizar usuário");
      }

      setUsuarios((prev) =>
        prev.map((u) => {
          if (u.id !== usuarioId) return u;

          const updatedEscolaId =
            editForm.escola_id !== undefined ? editForm.escola_id : u.escola_id;
          const updatedEscolaNome = updatedEscolaId
            ? escolas.find((e) => e.id === updatedEscolaId)?.nome ?? null
            : null;

          return {
            ...u,
            ...editForm,
            escola_id: updatedEscolaId,
            escola_nome: updatedEscolaNome,
          };
        })
      );

      setEditingId(null);
      setEditForm({});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
    setError(null);
  };

  const handleDelete = async (usuarioId: string, usuarioEmail: string) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir/arquivar o usuário ${usuarioEmail}? Ele perderá acesso, mas o histórico poderá ser mantido.`
      )
    ) {
      return;
    }

    try {
      setSaving(usuarioId);
      setError(null);

      const res = await fetch("/api/super-admin/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: usuarioId }),
      });

      const result = await res.json();

      if (!res.ok || !result.ok) {
        throw new Error(result.error || "Falha ao excluir usuário");
      }

      // Some imediatamente da lista atual (estado local)
      setUsuarios((prev) => prev.filter((u) => u.id !== usuarioId));

      // Se o Auth não foi excluído de fato, mas foi marcado como deleted, loga um aviso
      if (result.authDeleted === false) {
        console.warn(
          "[Super Admin] Usuário removido da aplicação, mas houve alerta no Auth:",
          result.authMessage
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSaving(null);
    }
  };

  const handleInputChange = (field: keyof Usuario, value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value === "" ? null : value,
    }));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Usuários Globais</h1>
        <Link
          href="/super-admin/usuarios/novo"
          className="px-4 py-2 rounded-lg bg-moxinexa-teal text-white hover:bg-moxinexa-teal/80 transition-colors"
        >
          + Novo Usuário
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="py-3 px-4 text-left w-12">#</th>
              <th className="py-3 px-4 text-left">Número Login</th>
              <th className="py-3 px-4 text-left">Nome</th>
              <th className="py-3 px-4 text-left">Email</th>
              <th className="py-3 px-4 text-left">Telefone</th>
              <th className="py-3 px-4 text-left">Papel Global</th>
              <th className="py-3 px-4 text-left">Escola</th>
              <th className="py-3 px-4 text-left">Função na Escola</th>
              <th className="py-3 px-4 text-left">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-gray-500">
                  Carregando usuários...
                </td>
              </tr>
            ) : error && usuarios.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-red-600">
                  Erro ao carregar: {error}
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-gray-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u, index) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  {/* Número Sequencial */}
                  <td className="py-3 px-4 text-center font-medium text-gray-600">
                    {index + 1}
                  </td>

                  {/* Número Login */}
                  <td className="py-3 px-4">
                    {editingId === u.id ? (
                      <input
                        type="text"
                        value={editForm.numero_login || ""}
                        onChange={(e) =>
                          handleInputChange("numero_login", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Número de login"
                      />
                    ) : (
                      <span className="font-mono text-xs text-blue-600">
                        {u.numero_login ?? "—"}
                      </span>
                    )}
                  </td>

                  {/* Nome */}
                  <td className="py-3 px-4">
                    {editingId === u.id ? (
                      <input
                        type="text"
                        value={editForm.nome || ""}
                        onChange={(e) =>
                          handleInputChange("nome", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="Nome completo"
                      />
                    ) : (
                      u.nome ?? "—"
                    )}
                  </td>

                  {/* Email */}
                  <td className="py-3 px-4">
                    {editingId === u.id ? (
                      <input
                        type="email"
                        value={editForm.email || ""}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Email"
                      />
                    ) : (
                      u.email
                    )}
                  </td>

                  {/* Telefone */}
                  <td className="py-3 px-4">
                    {editingId === u.id ? (
                      <input
                        type="tel"
                        value={editForm.telefone || ""}
                        onChange={(e) =>
                          handleInputChange("telefone", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="Telefone"
                      />
                    ) : (
                      u.telefone ?? "—"
                    )}
                  </td>

                  {/* Papel Global */}
                  <td className="py-3 px-4">
                    {editingId === u.id ? (
                      <select
                        value={editForm.role || ""}
                        onChange={(e) =>
                          handleInputChange("role", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    ) : (
                      <span className="capitalize">{u.role}</span>
                    )}
                  </td>

                  {/* Escola */}
                  <td className="py-3 px-4">
                    {editingId === u.id ? (
                      <select
                        value={editForm.escola_id || ""}
                        onChange={(e) =>
                          handleInputChange("escola_id", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        <option value="">— Sem escola —</option>
                        {escolas.map((escola) => (
                          <option key={escola.id} value={escola.id}>
                            {escola.nome}
                          </option>
                        ))}
                      </select>
                    ) : (
                      u.escola_nome ??
                        (u.escola_id
                          ? escolas.find((escola) => escola.id === u.escola_id)?.nome ?? "—"
                          : "—")
                    )}
                  </td>

                  {/* Função na Escola */}
                  <td className="py-3 px-4">
                    {editingId === u.id ? (
                      <select
                        value={editForm.papel_escola || ""}
                        onChange={(e) =>
                          handleInputChange("papel_escola", e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        <option value="">— Sem função —</option>
                        <option value="admin_escola">Diretor(a)</option>
                        <option value="admin">Administrador(a)</option>
                        <option value="staff_admin">Coordenador(a)</option>
                        <option value="financeiro">Financeiro</option>
                        <option value="secretaria">Secretário(a)</option>
                        <option value="professor">Professor(a)</option>
                      </select>
                    ) : (
                      u.papel_escola ?? "—"
                    )}
                  </td>

                  {/* Ações */}
                  <td className="py-3 px-4">
                    {editingId === u.id ? (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleSave(u.id)}
                          disabled={saving === u.id}
                          tone="green"
                          size="sm"
                          className="px-3"
                        >
                          {saving === u.id ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button
                          onClick={handleCancel}
                          disabled={saving === u.id}
                          tone="gray"
                          size="sm"
                          className="px-3"
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleEdit(u)}
                          tone="blue"
                          size="sm"
                          className="px-3"
                        >
                          Editar
                        </Button>
                        <Button
                          onClick={() => handleDelete(u.id, u.email)}
                          disabled={saving === u.id}
                          tone="red"
                          size="sm"
                          className="px-3"
                        >
                          {saving === u.id ? "Excluindo..." : "Excluir"}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
