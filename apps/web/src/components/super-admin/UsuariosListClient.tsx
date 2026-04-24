"use client";

/**
 * UsuariosListClient — Super Admin Portal
 * Design: Clean Enterprise — clareza, confiança institucional, legibilidade B2B.
 * Tokens KLASSE: Primary (#1F6B3B), Accent (#E3B23C), Light UI (slate-50 / white).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Filter, Mail, Pencil, Plus, Search, Shield, Trash2, X } from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Usuario = {
  id: string;
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

// ─── Tokens & Mapas (Versão Light) ────────────────────────────────────────────

const ROLE_META: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  super_admin:  { bg: "bg-green-50",   border: "border-green-200", text: "text-[#1F6B3B]", dot: "bg-[#1F6B3B]", label: "Super Admin"  },
  global_admin: { bg: "bg-amber-50",   border: "border-amber-200", text: "text-[#E3B23C]", dot: "bg-[#E3B23C]", label: "Global Admin" },
  admin:        { bg: "bg-slate-100",  border: "border-slate-200", text: "text-slate-700", dot: "bg-slate-500", label: "Admin"        },
  admin_escola: { bg: "bg-slate-100",  border: "border-slate-200", text: "text-slate-700", dot: "bg-slate-500", label: "Admin"        },
  staff_admin:  { bg: "bg-slate-100",  border: "border-slate-200", text: "text-slate-700", dot: "bg-slate-500", label: "Admin"        },
  secretaria:   { bg: "bg-blue-50",    border: "border-blue-200",  text: "text-blue-700", dot: "bg-blue-500",  label: "Secretaria"   },
  financeiro:   { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", label: "Financeiro" },
  secretaria_financeiro: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", dot: "bg-indigo-500", label: "Sec. + Fin" },
  admin_financeiro: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", dot: "bg-indigo-500", label: "Admin + Fin" },
  user:         { bg: "bg-white",      border: "border-slate-200", text: "text-slate-500", dot: "bg-slate-300", label: "User"         },
};

const PAPEL_LABEL: Record<string, string> = {
  admin_escola:           "Director(a)",
  admin:                  "Administrador(a)",
  staff_admin:            "Coordenador(a)",
  financeiro:             "Financeiro",
  secretaria:             "Secretário(a)",
  secretaria_financeiro:  "Sec. + Financeiro",
  admin_financeiro:       "Admin + Financeiro",
  professor:              "Professor(a)",
};

const PAPEL_OPTIONS = [
  "admin_escola",
  "admin",
  "staff_admin",
  "secretaria",
  "financeiro",
  "secretaria_financeiro",
  "admin_financeiro",
  "professor",
];

const mapPapelToRole = (papel?: string | null) => {
  if (!papel) return "";
  return papel;
};

// ─── Helpers Visuais ──────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role] ?? ROLE_META["user"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${m.bg} ${m.border} border ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: 4 }).map((_, j) => (
        <td key={j} className="py-4 px-6">
          <div className="h-3 rounded-md bg-slate-200 animate-pulse" style={{ width: `${40 + (j * 15) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// Input reutilizável (Focado nos tokens KLASSE Light)
const inputCls = `w-full px-3 py-2 rounded-xl text-sm font-geist bg-white border border-slate-300
  text-slate-900 placeholder:text-slate-400 transition-all shadow-sm
  focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20 focus:border-[#E3B23C]`;

// ─── Password Helpers ─────────────────────────────────────────────────────────

const passwordRules = (pwd: string) => [
  { ok: pwd.length >= 8,          msg: "8+ chars"     },
  { ok: /[A-Z]/.test(pwd),        msg: "Maiúscula"    },
  { ok: /[a-z]/.test(pwd),        msg: "Minúscula"    },
  { ok: /\d/.test(pwd),           msg: "Número"       },
  { ok: /[^A-Za-z0-9]/.test(pwd), msg: "Especial"     },
];

function generateStrongPassword(len = 16) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let pwd = "";
  for (let i = 0; i < len; i++) pwd += charset[Math.floor(Math.random() * charset.length)];
  return pwd;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function SuperAdminUsuariosListClient() {
  return <ListaUsuarios />;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

function ListaUsuarios() {
  const [usuarios, setUsuarios]   = useState<Usuario[]>([]);
  const [escolas,  setEscolas]    = useState<Escola[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [erro,     setErro]       = useState<string | null>(null);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editForm,  setEditForm]    = useState<Partial<Usuario>>({});
  const [saving,    setSaving]      = useState<string | null>(null);

  // Reset password modal
  const [resetUser,         setResetUser]         = useState<Usuario | null>(null);
  const [resetPassword,     setResetPassword]     = useState("");
  const [resetMustChange,   setResetMustChange]   = useState(true);
  const [resetError,        setResetError]        = useState<string | null>(null);
  const [resetLoading,      setResetLoading]      = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true); 
        setErro(null);
        
        // Simulação API
        const [usersRes, escolasRes] = await Promise.all([
          fetch("/api/super-admin/users/list", { cache: "no-store" }),
          fetch("/api/super-admin/escolas/list", { cache: "no-store" }),
        ]);
        
        if (!usersRes.ok || !escolasRes.ok) throw new Error("Falha na comunicação com os servidores KLASSE.");

        const usersJson   = await usersRes.json();
        const escolasJson = await escolasRes.json();

        const escolasArr = (escolasJson.items || []) as Escola[];
        const nameMap    = new Map(escolasArr.map(e => [String(e.id), e.nome]));

        const filtered = ((usersJson.items || []) as Usuario[])
          .filter(u => u.papel_escola !== "aluno" && u.status !== "excluido")
          .map(u => ({
            ...u,
            escola_nome: u.escola_nome ?? (u.escola_id ? nameMap.get(String(u.escola_id)) ?? null : null),
          }));

        setUsuarios(filtered);
        setEscolas(escolasArr);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro crítico de sistema.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleEdit = (u: Usuario) => {
    setEditingId(u.id);
    setEditForm({ 
      nome: u.nome, email: u.email, telefone: u.telefone,
      role: u.escola_id ? (u.papel_escola ?? u.role) : u.role,
      escola_id: u.escola_id,
      papel_escola: u.papel_escola,
    });
  };

  const handleSave = async (uid: string) => {
    try {
      setSaving(uid);
      const updates: Partial<Usuario> = { ...editForm };

      if (updates.escola_id) {
        if (!updates.papel_escola && updates.role) {
          updates.papel_escola = updates.role;
        }
        delete (updates as Partial<Usuario>).role;
      }
      const res = await fetch("/api/super-admin/users/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, updates }),
      });
      if (!res.ok) throw new Error("Falha ao gravar.");
      
      setUsuarios(prev => prev.map(u => {
        if (u.id !== uid) return u;
        const eid = editForm.escola_id !== undefined ? editForm.escola_id : u.escola_id;
        return { 
          ...u, ...editForm, escola_id: eid,
          escola_nome: eid ? escolas.find(e => e.id === eid)?.nome ?? null : null 
        };
      }));
      setEditingId(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally { setSaving(null); }
  };

  const handleDelete = async (uid: string, email: string) => {
    if (!confirm(`Operação destrutiva: Revogar acesso a ${email}?`)) return;
    try {
      setSaving(uid);
      const res = await fetch("/api/super-admin/users/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      if (!res.ok) throw new Error("Falha ao revogar.");
      setUsuarios(prev => prev.filter(u => u.id !== uid));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao eliminar.");
    } finally { setSaving(null); }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    const failed = passwordRules(resetPassword).find(r => !r.ok);
    if (failed) { setResetError(`Protocolo falhou: Necessita de ${failed.msg.toLowerCase()}.`); return; }
    
    try {
      setResetLoading(true); setResetError(null);
      const res = await fetch("/api/super-admin/users/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetUser.id, password: resetPassword, mustChange: resetMustChange }),
      });
      if (!res.ok) throw new Error("A API rejeitou a nova credencial.");
      setResetUser(null);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Erro de sistema.");
    } finally { setResetLoading(false); }
  };

  const handleResendInvite = async (u: Usuario) => {
    try {
      setSaving(u.id);
      const res = await fetch("/api/super-admin/users/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, mode: "credentials" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Falha ao reenviar convite.");
      }
      toast.success(`Credenciais reenviadas para ${u.email}.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao reenviar convite.";
      setErro(message);
      toast.error(message);
    } finally {
      setSaving(null);
    }
  };

  const filteredUsers = usuarios.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.nome && u.nome.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sora selection:bg-[#E3B23C]/20">

      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-3 w-3 rounded-full bg-[#1F6B3B] ring-4 ring-[#1F6B3B]/10" />
            <div>
              <h1 className="text-sm font-bold text-[#1F6B3B] tracking-wide uppercase">KLASSE Overwatch</h1>
              <p className="text-[10px] text-slate-500 font-geist">Gestão Global de Identidades</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Procurar utilizador..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 pl-9 pr-4 py-2 rounded-xl text-xs font-geist bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20 transition-all shadow-sm"
              />
            </div>
            <Link
              href="/super-admin/usuarios/novo"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E3B23C] hover:brightness-95 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Novo Registo
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {erro && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-geist">
            <Shield className="w-5 h-5 flex-shrink-0" />
            <p>{erro}</p>
          </div>
        )}

        {/* ── Tabela Principal ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Identidade</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Acesso Global</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tenant (Escola)</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Comandos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-geist text-sm">
                
                {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                
                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-500">
                      Nenhum utilizador encontrado no ecossistema.
                    </td>
                  </tr>
                )}

                {!loading && filteredUsers.map((u) => {
                  const isEditing = editingId === u.id;
                  const isSaving  = saving === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                      
                      {/* Identidade */}
                      <td className="py-4 px-6">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input type="text" value={editForm.nome || ""} onChange={e => setEditForm({...editForm, nome: e.target.value})} className={inputCls} placeholder="Nome" />
                            <input type="email" value={editForm.email || ""} onChange={e => setEditForm({...editForm, email: e.target.value})} className={inputCls} placeholder="Email" />
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold text-slate-900">{u.nome || "S/ Nome Registado"}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{u.email}</p>
                          </div>
                        )}
                      </td>

                      {/* Acesso Global */}
                      <td className="py-4 px-6">
                        {isEditing ? (
                          editForm.escola_id ? (
                            <div className="space-y-1">
                              <RoleBadge role={mapPapelToRole(editForm.papel_escola) || "user"} />
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Derivado do papel da escola</p>
                            </div>
                          ) : (
                            <select
                              value={editForm.role || ""}
                              onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                              className={inputCls}
                            >
                              <option value="user">User Normal</option>
                              <option value="admin">Admin</option>
                              <option value="financeiro">Financeiro</option>
                              <option value="secretaria_financeiro">Secretário + Financeiro</option>
                              <option value="admin_financeiro">Admin + Financeiro</option>
                              <option value="global_admin">Global Admin</option>
                              <option value="super_admin">Super Admin (Perigoso)</option>
                            </select>
                          )
                        ) : (
                          <RoleBadge role={u.role} />
                        )}
                      </td>

                      {/* Tenant / Escola */}
                      <td className="py-4 px-6">
                        {isEditing ? (
                          <div className="space-y-2">
                            <select
                              value={editForm.escola_id || ""}
                              onChange={e => setEditForm({ ...editForm, escola_id: e.target.value })}
                              className={inputCls}
                            >
                              <option value="">— Órfão (Sem Escola) —</option>
                              {escolas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                            </select>
                            <select
                              value={editForm.papel_escola || ""}
                              onChange={e =>
                                setEditForm({
                                  ...editForm,
                                  papel_escola: e.target.value,
                                  role: editForm.escola_id ? mapPapelToRole(e.target.value) : editForm.role,
                                })
                              }
                              className={inputCls}
                            >
                              <option value="">— Papel (Escola) —</option>
                              {PAPEL_OPTIONS.map((papel) => (
                                <option key={papel} value={papel}>
                                  {PAPEL_LABEL[papel] ?? papel}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <p className="text-slate-700 font-medium">{u.escola_nome || <span className="text-slate-400 italic">Sem Tenant</span>}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{PAPEL_LABEL[u.papel_escola ?? ""] ?? "N/A"}</p>
                          </div>
                        )}
                      </td>

                      {/* Comandos */}
                      <td className="py-4 px-6 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm">
                              Cancelar
                            </button>
                            <button onClick={() => handleSave(u.id)} disabled={isSaving} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-klasse-gold text-white text-xs font-bold hover:brightness-95 transition-colors shadow-sm disabled:opacity-50">
                              <Check className="w-3 h-3" /> {isSaving ? "A gravar..." : "Guardar"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(u)} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-klasse-gold hover:bg-slate-50 transition-all shadow-sm inline-flex items-center gap-2" title="Editar Perfil">
                              <Pencil className="w-4 h-4" />
                              <span className="hidden md:inline text-xs font-semibold">Editar</span>
                            </button>
                            <button onClick={() => { setResetUser(u); setResetPassword(""); setResetError(null); }} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-klasse-gold hover:bg-amber-50 transition-all shadow-sm inline-flex items-center gap-2" title="Forçar Nova Senha">
                              <Filter className="w-4 h-4" />
                              <span className="hidden md:inline text-xs font-semibold">Reset</span>
                            </button>
                            <button onClick={() => handleResendInvite(u)} disabled={isSaving} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-klasse-gold hover:bg-green-50 transition-all shadow-sm disabled:opacity-50 inline-flex items-center gap-2" title="Reenviar Convite">
                              <Mail className="w-4 h-4" />
                              <span className="hidden md:inline text-xs font-semibold">Reenviar</span>
                            </button>
                            <button onClick={() => handleDelete(u.id, u.email)} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm inline-flex items-center gap-2" title="Revogar Acesso">
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden md:inline text-xs font-semibold">Remover</span>
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
      </main>

      {/* ── Modal Reset Senha (Isolado e Crítico) ── */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-klasse-gold" />
                  Override de Credenciais
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">{resetUser.email}</p>
              </div>
              <button onClick={() => setResetUser(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Nova Senha Gerada</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={resetPassword}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-sm focus:outline-none"
                    placeholder="Clique em gerar..."
                  />
                  <button 
                    onClick={() => setResetPassword(generateStrongPassword())}
                    className="px-4 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Gerar
                  </button>
                </div>
              </div>

              {resetError && <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-200 font-medium">{resetError}</p>}

              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                <input 
                  type="checkbox" 
                  checked={resetMustChange}
                  onChange={e => setResetMustChange(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 bg-white text-[#E3B23C] focus:ring-[#E3B23C]/20 accent-[#E3B23C]" 
                />
                <span className="text-xs text-slate-600 font-medium">Obrigar utilizador a redefinir no próximo login</span>
              </label>

              <button 
                onClick={handleResetPassword} 
                disabled={!resetPassword || resetLoading}
                className="w-full py-3 rounded-xl bg-[#E3B23C] text-white text-sm font-bold hover:brightness-95 disabled:opacity-50 transition-all shadow-sm"
              >
                {resetLoading ? "A Injetar..." : "Forçar Override"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
