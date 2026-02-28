"use client";

/**
 * UsuariosListClient — Super Admin Portal
 * Design: Dark cockpit — autoridade, precisão, controlo total.
 * Tokens KLASSE: #1F6B3B (green), #E3B23C (gold), rose para crítico.
 * Fundo: slate-950. Acentos: green para acções seguras, gold para atenção.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

type Escola = { id: string; nome: string };

// ─── Tokens & mapas ───────────────────────────────────────────────────────────

const ROLE_META: Record<string, { pill: string; dot: string; label: string }> = {
  super_admin:  { pill: "bg-[#1F6B3B]/20 border border-[#1F6B3B]/40 text-[#4ade80]", dot: "bg-[#1F6B3B]",   label: "Super Admin"  },
  global_admin: { pill: "bg-[#E3B23C]/15 border border-[#E3B23C]/30 text-[#E3B23C]", dot: "bg-[#E3B23C]",   label: "Global Admin" },
  admin:        { pill: "bg-sky-500/10   border border-sky-500/20   text-sky-400",    dot: "bg-sky-500",     label: "Admin"        },
  user:         { pill: "bg-slate-800    border border-slate-700    text-slate-400",  dot: "bg-slate-600",   label: "User"         },
};

const PAPEL_LABEL: Record<string, string> = {
  admin_escola:           "Director(a)",
  admin:                  "Administrador(a)",
  staff_admin:            "Coordenador(a)",
  financeiro:             "Financeiro",
  secretaria:             "Secretário(a)",
  secretaria_financeiro:  "Sec. + Financeiro",
  professor:              "Professor(a)",
};

// ─── Helpers visuais ──────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role] ?? ROLE_META["user"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${m.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, j) => (
        <td key={j} className="py-4 px-4">
          <div className="h-3 rounded bg-slate-800 animate-pulse" style={{ width: `${35 + (j * 17) % 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

// Input dark reutilizável
const inputCls = `w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-950 border border-slate-700
  text-slate-100 placeholder:text-slate-600
  focus:outline-none focus:ring-1 focus:ring-[#1F6B3B]/50 focus:border-[#1F6B3B]/60
  transition-all`;

// ─── Password helpers ─────────────────────────────────────────────────────────

const passwordRules = (pwd: string) => [
  { ok: pwd.length >= 8,          msg: "8+ caracteres"     },
  { ok: /[A-Z]/.test(pwd),        msg: "Maiúscula"         },
  { ok: /[a-z]/.test(pwd),        msg: "Minúscula"         },
  { ok: /\d/.test(pwd),           msg: "Número"            },
  { ok: /[^A-Za-z0-9]/.test(pwd), msg: "Caractere especial"},
];

function generateStrongPassword(len = 14) {
  const u = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const l = "abcdefghijklmnopqrstuvwxyz";
  const n = "0123456789";
  const s = "!@#$%^&*()-_=+[];:,.?";
  const all = u + l + n + s;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pwd = pick(u) + pick(l) + pick(n) + pick(s);
  for (let i = pwd.length; i < len; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function UsuariosListClient() {
  return (
    <RequireSuperAdmin>
      <ListaUsuarios />
    </RequireSuperAdmin>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function ListaUsuarios() {
  const [usuarios, setUsuarios]     = useState<Usuario[]>([]);
  const [escolas,  setEscolas]      = useState<Escola[]>([]);
  const [loading,  setLoading]      = useState(true);
  const [erro,     setErro]         = useState<string | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editForm,  setEditForm]    = useState<Partial<Usuario>>({});
  const [saving,    setSaving]      = useState<string | null>(null);

  // Reset password modal
  const [resetUser,            setResetUser]            = useState<Usuario | null>(null);
  const [resetPassword,        setResetPassword]        = useState("");
  const [resetMustChange,      setResetMustChange]      = useState(true);
  const [resetError,           setResetError]           = useState<string | null>(null);
  const [resetLoading,         setResetLoading]         = useState(false);
  const [resetShowPassword,    setResetShowPassword]    = useState(false);
  const [resetCopied,          setResetCopied]          = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErro(null);
        const [usersRes, escolasRes] = await Promise.all([
          fetch("/api/super-admin/users/list"),
          fetch("/api/super-admin/escolas/list"),
        ]);
        if (!usersRes.ok)   throw new Error("Falha ao carregar utilizadores");
        if (!escolasRes.ok) throw new Error("Falha ao carregar escolas");

        const usersJson   = await usersRes.json();
        const escolasJson = await escolasRes.json();

        const escolasArr = (escolasJson.items || []) as Array<{ id: string; nome: string | null }>;
        const nameMap    = new Map(escolasArr.map(e => [String(e.id), e.nome ?? ""]));

        const filtered = ((usersJson.items || []) as Usuario[])
          .filter(u => u.papel_escola !== "aluno")
          .filter(u => u.ativo !== false && u.status !== "arquivado" && u.status !== "excluido")
          .map(u => ({
            ...u,
            escola_nome: u.escola_nome ?? (u.escola_id ? nameMap.get(String(u.escola_id)) ?? null : null),
          }));

        setUsuarios(filtered);
        setEscolas(escolasArr.map(e => ({ id: String(e.id), nome: e.nome ?? "" })));
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
        setUsuarios([]); setEscolas([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleEdit   = (u: Usuario) => {
    setEditingId(u.id);
    setEditForm({ nome: u.nome, email: u.email, telefone: u.telefone,
      role: u.role, escola_id: u.escola_id, papel_escola: u.papel_escola,
      numero_login: u.numero_login });
  };
  const handleCancel = () => { setEditingId(null); setEditForm({}); setErro(null); };

  const handleInputChange = (field: keyof Usuario, value: string) =>
    setEditForm(prev => ({ ...prev, [field]: value === "" ? null : value }));

  const handleSave = async (uid: string) => {
    try {
      setSaving(uid); setErro(null);
      const res    = await fetch("/api/super-admin/users/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, updates: editForm }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) throw new Error(result.error || "Falha ao actualizar");
      setUsuarios(prev => prev.map(u => {
        if (u.id !== uid) return u;
        const eid = editForm.escola_id !== undefined ? editForm.escola_id : u.escola_id;
        return { ...u, ...editForm, escola_id: eid,
          escola_nome: eid ? escolas.find(e => e.id === eid)?.nome ?? null : null };
      }));
      setEditingId(null); setEditForm({});
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setSaving(null); }
  };

  const handleDelete = async (uid: string, email: string) => {
    if (!confirm(`Excluir / arquivar ${email}? O acesso será removido.`)) return;
    try {
      setSaving(uid); setErro(null);
      const res = await fetch("/api/super-admin/users/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      const result = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !result.ok) throw new Error(result.error || "Falha ao excluir");
      setUsuarios(prev => prev.filter(u => u.id !== uid));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setSaving(null); }
  };

  const openResetModal  = (u: Usuario) => {
    setResetUser(u); setResetPassword(""); setResetMustChange(true);
    setResetError(null); setResetShowPassword(false); setResetCopied(false);
  };
  const closeResetModal = () => {
    setResetUser(null); setResetPassword(""); setResetError(null);
    setResetLoading(false); setResetCopied(false);
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    const failed = passwordRules(resetPassword).find(r => !r.ok);
    if (failed) { setResetError(`Senha inválida: ${failed.msg}`); return; }
    try {
      setResetLoading(true); setResetError(null);
      const res  = await fetch("/api/super-admin/users/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetUser.id, password: resetPassword, mustChange: resetMustChange }),
      });
      const json = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao redefinir senha");
      closeResetModal();
    } catch (e) {
      setResetError(e instanceof Error ? e.message : String(e));
    } finally { setResetLoading(false); }
  };

  // ── Colunas ────────────────────────────────────────────────────────────────
  const cols = ["#", "Nº Login", "Nome", "Email", "Telefone", "Papel Global", "Escola", "Função", "Acções"];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950">

      {/* ── Top bar ── */}
      <div className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

          {/* Breadcrumb / título */}
          <div className="flex items-center gap-3">
            {/* Dot de estado */}
            <span className="flex h-2 w-2 rounded-full bg-[#1F6B3B] ring-4 ring-[#1F6B3B]/20" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Super Admin
            </span>
            <span className="text-slate-700">›</span>
            <span className="text-sm font-bold text-slate-100">Utilizadores</span>
            {!loading && (
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">
                {usuarios.length}
              </span>
            )}
          </div>

          {/* CTA */}
          <Link
            href="/super-admin/usuarios/novo"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl
              bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 text-white text-xs font-bold
              transition-all hover:shadow-lg hover:shadow-[#1F6B3B]/20"
          >
            <span className="text-sm leading-none font-black">+</span>
            Novo Utilizador
          </Link>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6">

        {/* Erro global */}
        {erro && (
          <div className="mb-5 flex items-start gap-3 p-4 rounded-xl
            bg-rose-950/30 border border-rose-500/20 text-rose-300 text-sm">
            <span className="text-rose-500 flex-shrink-0 mt-0.5">⚠</span>
            {erro}
          </div>
        )}

        {/* Tabela */}
        <div className="rounded-2xl bg-slate-900 ring-1 ring-slate-800 overflow-hidden">

          {/* Cabeçalho da tabela */}
          <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Registos activos
            </p>
            {!loading && (
              <p className="text-[10px] text-slate-600">
                {usuarios.length} utilizador{usuarios.length !== 1 ? "es" : ""}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">

              <thead>
                <tr className="border-b border-slate-800/80">
                  {cols.map(h => (
                    <th key={h}
                      className="py-3 px-4 text-left text-[10px] font-bold
                        text-slate-500 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/50">

                {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

                {!loading && erro && usuarios.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-rose-400 text-sm">
                      Erro ao carregar: {erro}
                    </td>
                  </tr>
                )}

                {!loading && !erro && usuarios.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-20 text-center">
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-700
                        flex items-center justify-center mx-auto mb-3">
                        <span className="text-slate-600 text-lg">◎</span>
                      </div>
                      <p className="text-sm text-slate-500">Nenhum utilizador encontrado</p>
                    </td>
                  </tr>
                )}

                {!loading && usuarios.map((u, idx) => {
                  const isEditing = editingId === u.id;
                  const isSaving  = saving === u.id;

                  return (
                    <tr key={u.id}
                      className={`transition-colors duration-75 ${
                        isEditing ? "bg-slate-800/70" : "hover:bg-slate-800/30"
                      }`}>

                      {/* # */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-mono text-slate-700">{idx + 1}</span>
                      </td>

                      {/* Nº Login */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input type="text" value={editForm.numero_login || ""}
                            onChange={e => handleInputChange("numero_login", e.target.value)}
                            className={inputCls} placeholder="Nº login" />
                        ) : (
                          <span className="font-mono text-xs font-bold text-[#E3B23C]">
                            {u.numero_login ?? "—"}
                          </span>
                        )}
                      </td>

                      {/* Nome */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input type="text" value={editForm.nome || ""}
                            onChange={e => handleInputChange("nome", e.target.value)}
                            className={inputCls} placeholder="Nome completo" />
                        ) : (
                          <span className="text-slate-100 font-semibold text-sm">
                            {u.nome ?? "—"}
                          </span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input type="email" value={editForm.email || ""}
                            onChange={e => handleInputChange("email", e.target.value)}
                            className={inputCls} placeholder="Email" />
                        ) : (
                          <span className="text-slate-500 text-xs">{u.email}</span>
                        )}
                      </td>

                      {/* Telefone */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input type="tel" value={editForm.telefone || ""}
                            onChange={e => handleInputChange("telefone", e.target.value)}
                            className={inputCls} placeholder="Telefone" />
                        ) : (
                          <span className="text-slate-500 text-xs">{u.telefone ?? "—"}</span>
                        )}
                      </td>

                      {/* Papel Global */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <select value={editForm.role || ""}
                            onChange={e => handleInputChange("role", e.target.value)}
                            className={inputCls}>
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
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <select value={editForm.escola_id || ""}
                            onChange={e => handleInputChange("escola_id", e.target.value)}
                            className={inputCls}>
                            <option value="">— Sem escola —</option>
                            {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                          </select>
                        ) : (
                          <span className="text-slate-500 text-xs">
                            {u.escola_nome ?? (u.escola_id
                              ? escolas.find(e => e.id === u.escola_id)?.nome ?? "—"
                              : "—")}
                          </span>
                        )}
                      </td>

                      {/* Função */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <select value={editForm.papel_escola || ""}
                            onChange={e => handleInputChange("papel_escola", e.target.value)}
                            className={inputCls}>
                            <option value="">— Sem função —</option>
                            <option value="admin_escola">Director(a)</option>
                            <option value="admin">Administrador(a)</option>
                            <option value="staff_admin">Coordenador(a)</option>
                            <option value="financeiro">Financeiro</option>
                            <option value="secretaria">Secretário(a)</option>
                            <option value="secretaria_financeiro">Sec. + Financeiro</option>
                            <option value="professor">Professor(a)</option>
                          </select>
                        ) : (
                          <span className="text-slate-500 text-xs">
                            {PAPEL_LABEL[u.papel_escola ?? ""] ?? u.papel_escola ?? "—"}
                          </span>
                        )}
                      </td>

                      {/* Acções */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleSave(u.id)} disabled={isSaving}
                              className="px-3 py-1.5 rounded-lg bg-[#1F6B3B] hover:bg-[#1F6B3B]/80
                                disabled:opacity-40 text-white text-xs font-bold transition-colors">
                              {isSaving ? "A guardar…" : "Guardar"}
                            </button>
                            <button onClick={handleCancel} disabled={isSaving}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700
                                border border-slate-700 disabled:opacity-40
                                text-slate-400 text-xs font-semibold transition-colors">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleEdit(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700
                                border border-slate-700 text-slate-300 text-xs font-semibold
                                transition-colors">
                              Editar
                            </button>
                            <button onClick={() => openResetModal(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#E3B23C]/10 hover:bg-[#E3B23C]/20
                                border border-[#E3B23C]/20 text-[#E3B23C] text-xs font-semibold
                                transition-colors">
                              Senha
                            </button>
                            <button onClick={() => handleDelete(u.id, u.email)} disabled={isSaving}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20
                                border border-rose-500/20 disabled:opacity-40
                                text-rose-400 text-xs font-semibold transition-colors">
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
      </div>

      {/* ── Modal Reset Senha ── */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
          bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900
            ring-1 ring-slate-700 shadow-2xl overflow-hidden">

            {/* Topo do modal — barra de acento */}
            <div className="h-0.5 bg-gradient-to-r from-[#E3B23C]/60 via-[#E3B23C] to-[#E3B23C]/60" />

            <div className="p-6">

              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#E3B23C] mb-1">
                    Redefinir senha
                  </p>
                  <h3 className="text-base font-bold text-slate-100">
                    {resetUser.nome ?? resetUser.email}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{resetUser.email}</p>
                </div>
                <button onClick={closeResetModal}
                  className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700
                    border border-slate-700 text-slate-400 hover:text-slate-200
                    flex items-center justify-center text-lg font-light transition-colors">
                  ×
                </button>
              </div>

              <div className="space-y-5">

                {/* Input + acções */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest
                    text-slate-500 mb-2">Nova senha</label>
                  <div className="flex gap-2 mb-2">
                    <div className="relative flex-1">
                      <input
                        type={resetShowPassword ? "text" : "password"}
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        className={`${inputCls} pr-10`}
                        placeholder="Digite ou gere uma senha"
                      />
                      <button type="button"
                        onClick={() => setResetShowPassword(p => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2
                          text-[10px] text-slate-500 hover:text-slate-300 transition-colors font-bold uppercase">
                        {resetShowPassword ? "ocultar" : "ver"}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setResetPassword(generateStrongPassword()); setResetCopied(false); }}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700
                        border border-slate-700 text-slate-300 text-xs font-semibold transition-colors">
                      Gerar senha forte
                    </button>
                    <button
                      disabled={!resetPassword}
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(resetPassword); setResetCopied(true); }
                        catch { setResetCopied(false); }
                      }}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700
                        border border-slate-700 disabled:opacity-40
                        text-slate-300 text-xs font-semibold transition-colors min-w-[80px]">
                      {resetCopied ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>

                {/* Regras de password */}
                <div className="grid grid-cols-2 gap-1.5 p-3 rounded-xl bg-slate-950
                  border border-slate-800">
                  {passwordRules(resetPassword).map(rule => (
                    <span key={rule.msg}
                      className={`text-[10px] flex items-center gap-1.5 font-medium transition-colors ${
                        rule.ok ? "text-[#4ade80]" : "text-slate-600"
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                        rule.ok ? "bg-[#1F6B3B]" : "bg-slate-700"
                      }`} />
                      {rule.msg}
                    </span>
                  ))}
                </div>

                {/* Checkbox must change */}
                <label className="flex items-center gap-3 p-3 rounded-xl
                  bg-slate-800 border border-slate-700 cursor-pointer
                  hover:border-slate-600 transition-colors">
                  <input type="checkbox" checked={resetMustChange}
                    onChange={e => setResetMustChange(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-700
                      text-[#1F6B3B] focus:ring-[#1F6B3B]/30 accent-[#1F6B3B]" />
                  <span className="text-xs text-slate-300">
                    Exigir troca de senha no próximo login
                  </span>
                </label>

                {/* Erro */}
                {resetError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl
                    bg-rose-950/30 border border-rose-500/20 text-rose-300 text-xs">
                    <span className="text-rose-500 flex-shrink-0">⚠</span>
                    {resetError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-6 flex gap-2 justify-end">
                <button onClick={closeResetModal}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700
                    border border-slate-700 text-slate-400 text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button onClick={handleResetPassword} disabled={resetLoading}
                  className="px-4 py-2.5 rounded-xl bg-[#E3B23C] hover:bg-[#E3B23C]/90
                    disabled:opacity-40 text-slate-900 text-sm font-bold transition-colors">
                  {resetLoading ? "A guardar…" : "Redefinir senha"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}