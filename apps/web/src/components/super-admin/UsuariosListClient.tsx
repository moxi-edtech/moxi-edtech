"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";

// ─── Tipos — inalterados ──────────────────────────────────────────────────────
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
  ativo?: boolean | null;
  status?: string | null;
};

type Escola = {
  id: string;
  nome: string;
};

// ─── Helpers visuais ──────────────────────────────────────────────────────────
const ROLE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  super_admin:  { bg: "bg-emerald-500/15 border border-emerald-500/25", text: "text-emerald-400", label: "Super Admin" },
  global_admin: { bg: "bg-emerald-500/10 border border-emerald-500/20", text: "text-emerald-300", label: "Global Admin" },
  admin:        { bg: "bg-sky-500/15 border border-sky-500/25",         text: "text-sky-400",     label: "Admin"       },
  user:         { bg: "bg-slate-700 border border-slate-600",           text: "text-slate-300",   label: "User"        },
};

const PAPEL_LABEL: Record<string, string> = {
  admin_escola:  "Director(a)",
  admin:         "Administrador(a)",
  staff_admin:   "Coordenador(a)",
  financeiro:    "Financeiro",
  secretaria:    "Secretário(a)",
  secretaria_financeiro: "Secretaria + Financeiro",
  professor:     "Professor(a)",
};

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_BADGE[role] ?? ROLE_BADGE["user"];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// Input dark reutilizável
const inputCls = "w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50";
const selectCls = inputCls;

// ─── Exports ─────────────────────────────────────────────────────────────────
export default function UsuariosListClient() {
  return (
    <RequireSuperAdmin>
      <ListaUsuarios />
    </RequireSuperAdmin>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ListaUsuarios — LÓGICA INTACTA, só visual alterado
// ─────────────────────────────────────────────────────────────────────────────
function ListaUsuarios() {
  const [usuarios, setUsuarios]       = useState<Usuario[]>([]);
  const [escolas, setEscolas]         = useState<Escola[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editForm, setEditForm]       = useState<Partial<Usuario>>({});
  const [saving, setSaving]           = useState<string | null>(null);
  const [resetUser, setResetUser]     = useState<Usuario | null>(null);
  const [resetPassword, setResetPassword]   = useState("");
  const [resetMustChange, setResetMustChange] = useState(true);
  const [resetError, setResetError]   = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetCopied, setResetCopied] = useState(false);

  // ── Funções de password — inalteradas ──────────────────────────────────────
  const passwordRules = (password: string) => [
    { ok: password.length >= 8,          msg: "Pelo menos 8 caracteres"  },
    { ok: /[A-Z]/.test(password),        msg: "1 letra maiúscula"        },
    { ok: /[a-z]/.test(password),        msg: "1 letra minúscula"        },
    { ok: /\d/.test(password),           msg: "1 número"                 },
    { ok: /[^A-Za-z0-9]/.test(password), msg: "1 caractere especial"     },
  ];

  const generateStrongPassword = (len = 12) => {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const nums = "0123456789";
    const special = "!@#$%^&*()-_=+[]{};:,.?";
    const all = upper + lower + nums + special;
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
    let pwd = pick(upper) + pick(lower) + pick(nums) + pick(special);
    for (let i = pwd.length; i < len; i++) pwd += pick(all);
    return pwd.split("").sort(() => Math.random() - 0.5).join("");
  };

  // ── Fetch — inalterado ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [usersRes, escolasRes] = await Promise.all([
          fetch("/api/super-admin/users/list"),
          fetch("/api/super-admin/escolas/list"),
        ]);

        if (!usersRes.ok)   throw new Error("Falha ao carregar usuários");
        if (!escolasRes.ok) throw new Error("Falha ao carregar escolas");

        const usersJson   = await usersRes.json();
        const escolasJson = await escolasRes.json();

        const escolasArr = (escolasJson.items || []) as Array<{ id: string; nome: string | null }>;
        const escolaNameMap = new Map(escolasArr.map((e) => [String(e.id), e.nome ?? ""]));

        const filteredUsers = ((usersJson.items || []) as Usuario[])
          .filter((u) => u.papel_escola !== "aluno")
          .filter((u) => {
            if (u.ativo === false) return false;
            if (u.status === "arquivado" || u.status === "excluido") return false;
            return true;
          })
          .map((u) => ({
            ...u,
            escola_nome: u.escola_nome ??
              (u.escola_id ? escolaNameMap.get(String(u.escola_id)) ?? null : null),
          }));

        setUsuarios(filteredUsers);
        setEscolas(escolasArr.map((e) => ({ id: String(e.id), nome: e.nome ?? "" })));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setUsuarios([]);
        setEscolas([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── Handlers — inalterados ─────────────────────────────────────────────────
  const handleEdit = (u: Usuario) => {
    setEditingId(u.id);
    setEditForm({ nome: u.nome, email: u.email, telefone: u.telefone,
      role: u.role, escola_id: u.escola_id, papel_escola: u.papel_escola,
      numero_login: u.numero_login });
  };

  const handleSave = async (usuarioId: string) => {
    try {
      setSaving(usuarioId); setError(null);
      const res = await fetch("/api/super-admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: usuarioId, updates: editForm }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) throw new Error(result.error || "Falha ao atualizar");
      setUsuarios((prev) => prev.map((u) => {
        if (u.id !== usuarioId) return u;
        const updatedEscolaId = editForm.escola_id !== undefined ? editForm.escola_id : u.escola_id;
        return { ...u, ...editForm, escola_id: updatedEscolaId,
          escola_nome: updatedEscolaId ? escolas.find((e) => e.id === updatedEscolaId)?.nome ?? null : null };
      }));
      setEditingId(null); setEditForm({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setSaving(null); }
  };

  const handleCancel = () => { setEditingId(null); setEditForm({}); setError(null); };

  const handleDelete = async (usuarioId: string, usuarioEmail: string) => {
    if (!confirm(`Tem certeza que deseja excluir/arquivar o utilizador ${usuarioEmail}? Ele perderá acesso, mas o histórico poderá ser mantido.`)) return;
    try {
      setSaving(usuarioId); setError(null);
      const res = await fetch("/api/super-admin/users/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: usuarioId }),
      });
      const result = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !result.ok) throw new Error(result.error || "Falha ao excluir");
      setUsuarios((prev) => prev.filter((u) => u.id !== usuarioId));
      if (result.authDeleted === false) console.warn("[Super Admin] Auth aviso:", result.authMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setSaving(null); }
  };

  const openResetModal  = (u: Usuario) => { setResetUser(u); setResetPassword(""); setResetMustChange(true); setResetError(null); setResetShowPassword(false); };
  const closeResetModal = () => { setResetUser(null); setResetPassword(""); setResetError(null); setResetLoading(false); setResetCopied(false); };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    const failedRule = passwordRules(resetPassword).find((r) => !r.ok);
    if (failedRule) { setResetError(`Senha inválida: ${failedRule.msg}`); return; }
    try {
      setResetLoading(true); setResetError(null);
      const res = await fetch("/api/super-admin/users/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetUser.id, password: resetPassword, mustChange: resetMustChange }),
      });
      const json = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao redefinir senha");
      closeResetModal();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : String(err));
    } finally { setResetLoading(false); }
  };

  const handleInputChange = (field: keyof Usuario, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value === "" ? null : value }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Utilizadores Globais</h1>
          {!loading && (
            <p className="text-xs text-slate-500 mt-0.5">
              {usuarios.length} utilizador{usuarios.length !== 1 ? "es" : ""} activo{usuarios.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Link
          href="/super-admin/usuarios/novo"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
        >
          <span className="text-base leading-none">+</span> Novo Utilizador
        </Link>
      </div>

      {/* Erro */}
      {error && (
        <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-sm">
          <span className="text-red-400 mt-0.5">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-xl bg-slate-900 ring-1 ring-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">

            {/* Cabeçalho */}
            <thead>
              <tr className="border-b border-slate-800">
                {["#", "Nº Login", "Nome", "Email", "Telefone", "Papel Global", "Escola", "Função", "Acções"].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">

              {/* Loading */}
              {loading && [...Array(5)].map((_, i) => (
                <tr key={`sk-${i}`}>
                  {[...Array(9)].map((_, j) => (
                    <td key={j} className="py-3.5 px-4">
                      <div className="h-3.5 bg-slate-800 rounded animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))}

              {/* Erro sem dados */}
              {!loading && error && usuarios.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-red-400 text-sm">
                    Erro ao carregar: {error}
                  </td>
                </tr>
              )}

              {/* Vazio */}
              {!loading && !error && usuarios.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="text-2xl mb-2 text-slate-700">◎</div>
                    <p className="text-sm text-slate-500">Nenhum utilizador encontrado</p>
                  </td>
                </tr>
              )}

              {/* Linhas */}
              {!loading && usuarios.map((u, index) => {
                const isEditing = editingId === u.id;
                const isSaving  = saving === u.id;

                return (
                  <tr
                    key={u.id}
                    className={`transition-colors duration-100 ${isEditing ? "bg-slate-800/60" : "hover:bg-slate-800/30"}`}
                  >
                    {/* # */}
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs font-mono text-slate-600">{index + 1}</span>
                    </td>

                    {/* Nº Login */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input type="text" value={editForm.numero_login || ""} onChange={(e) => handleInputChange("numero_login", e.target.value)} className={inputCls} placeholder="Número de login" />
                      ) : (
                        <span className="font-mono text-xs text-emerald-400">{u.numero_login ?? "—"}</span>
                      )}
                    </td>

                    {/* Nome */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input type="text" value={editForm.nome || ""} onChange={(e) => handleInputChange("nome", e.target.value)} className={inputCls} placeholder="Nome completo" />
                      ) : (
                        <span className="text-slate-200 font-medium">{u.nome ?? "—"}</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input type="email" value={editForm.email || ""} onChange={(e) => handleInputChange("email", e.target.value)} className={inputCls} placeholder="Email" />
                      ) : (
                        <span className="text-slate-400 text-xs">{u.email}</span>
                      )}
                    </td>

                    {/* Telefone */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input type="tel" value={editForm.telefone || ""} onChange={(e) => handleInputChange("telefone", e.target.value)} className={inputCls} placeholder="Telefone" />
                      ) : (
                        <span className="text-slate-400 text-xs">{u.telefone ?? "—"}</span>
                      )}
                    </td>

                    {/* Papel Global */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <select value={editForm.role || ""} onChange={(e) => handleInputChange("role", e.target.value)} className={selectCls}>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="global_admin">Global Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      ) : (
                        <RoleBadge role={u.role} />
                      )}
                    </td>

                    {/* Escola */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <select value={editForm.escola_id || ""} onChange={(e) => handleInputChange("escola_id", e.target.value)} className={selectCls}>
                          <option value="">— Sem escola —</option>
                          {escolas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </select>
                      ) : (
                        <span className="text-slate-400 text-xs">
                          {u.escola_nome ?? (u.escola_id ? escolas.find((e) => e.id === u.escola_id)?.nome ?? "—" : "—")}
                        </span>
                      )}
                    </td>

                    {/* Função */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <select value={editForm.papel_escola || ""} onChange={(e) => handleInputChange("papel_escola", e.target.value)} className={selectCls}>
                          <option value="">— Sem função —</option>
                          <option value="admin_escola">Director(a)</option>
                          <option value="admin">Administrador(a)</option>
                          <option value="staff_admin">Coordenador(a)</option>
                          <option value="financeiro">Financeiro</option>
                          <option value="secretaria">Secretário(a)</option>
                          <option value="secretaria_financeiro">Secretaria + Financeiro</option>
                          <option value="professor">Professor(a)</option>
                        </select>
                      ) : (
                        <span className="text-slate-400 text-xs">
                          {PAPEL_LABEL[u.papel_escola ?? ""] ?? u.papel_escola ?? "—"}
                        </span>
                      )}
                    </td>

                    {/* Acções */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleSave(u.id)} disabled={isSaving}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                            {isSaving ? "A guardar…" : "Guardar"}
                          </button>
                          <button onClick={handleCancel} disabled={isSaving}
                            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-xs font-semibold transition-colors">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(u)}
                            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold transition-colors">
                            Editar
                          </button>
                          <button onClick={() => openResetModal(u)}
                            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold transition-colors">
                            Senha
                          </button>
                          <button onClick={() => handleDelete(u.id, u.email)} disabled={isSaving}
                            className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 disabled:opacity-50 text-red-400 text-xs font-semibold transition-colors">
                            {isSaving ? "…" : "Excluir"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de redefinição de senha */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 ring-1 ring-white/10 p-6 shadow-2xl">

            {/* Header do modal */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Redefinir senha</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Utilizador: <span className="text-slate-300 font-medium">{resetUser.nome ?? resetUser.email}</span>
                </p>
              </div>
              <button onClick={closeResetModal}
                className="text-slate-600 hover:text-slate-300 text-xl leading-none transition-colors">
                ×
              </button>
            </div>

            <div className="space-y-4">

              {/* Input de senha */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nova senha
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type={resetShowPassword ? "text" : "password"}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className={`${inputCls} flex-1`}
                    placeholder="Digite a nova senha"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setResetPassword(generateStrongPassword()); setResetCopied(false); }}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold transition-colors whitespace-nowrap">
                      Gerar
                    </button>
                    <button
                      onClick={async () => { try { await navigator.clipboard.writeText(resetPassword); setResetCopied(true); } catch { setResetCopied(false); } }}
                      disabled={!resetPassword}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 text-xs font-semibold transition-colors whitespace-nowrap">
                      {resetCopied ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => setResetShowPassword((p) => !p)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  {resetShowPassword ? "Ocultar senha" : "Mostrar senha"}
                </button>
              </div>

              {/* Regras de password */}
              <div className="grid grid-cols-2 gap-1">
                {passwordRules(resetPassword).map((rule) => (
                  <span key={rule.msg} className={`text-xs flex items-center gap-1.5 ${rule.ok ? "text-emerald-400" : "text-slate-600"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rule.ok ? "bg-emerald-400" : "bg-slate-700"}`} />
                    {rule.msg}
                  </span>
                ))}
              </div>

              {/* Checkbox must change */}
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-600 transition-colors">
                <input type="checkbox" checked={resetMustChange} onChange={(e) => setResetMustChange(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500/30" />
                <span className="text-xs text-slate-300">Exigir troca de senha no próximo login</span>
              </label>

              {/* Erro */}
              {resetError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                  <span className="text-red-400 flex-shrink-0">⚠</span>
                  {resetError}
                </div>
              )}
            </div>

            {/* Footer do modal */}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={closeResetModal}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-semibold transition-colors">
                Cancelar
              </button>
              <button onClick={handleResetPassword} disabled={resetLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {resetLoading ? "A guardar…" : "Redefinir senha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}