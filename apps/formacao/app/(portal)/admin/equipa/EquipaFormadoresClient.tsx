"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  UserPlus,
  Mail,
  Phone,
  Trash2,
  Edit2,
  Key,
  X,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Wallet,
  User,
  GraduationCap,
  Tag
} from "lucide-react";

type AccessStatusKey =
  | "active"
  | "created"
  | "needs_password"
  | "pending_confirmation"
  | "blocked"
  | "unknown";

type FormadorAccess = {
  status: AccessStatusKey;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  must_change_password: boolean;
  banned_until: string | null;
  error: string | null;
};

type FormadorItem = {
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  nif: string | null;
  bi_numero: string | null;
  sexo: string | null;
  grau_academico: string | null;
  especialidades: string[] | null;
  bio: string | null;
  banco: string | null;
  iban: string | null;
  access?: FormadorAccess;
};

type ApiListResponse = {
  ok: boolean;
  error?: string;
  items?: FormadorItem[];
};

type ApiActionResponse = {
  ok: boolean;
  error?: string;
  item?: FormadorItem;
  created_new?: boolean;
  temporary_password?: string | null;
  email_sent?: boolean;
  email_error?: string | null;
  manual_access_url?: string | null;
  recovery_link_generated?: boolean;
  recovery_link_error?: string | null;
};

type ManualAccessLink = {
  email: string;
  url: string;
};

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm transition-all duration-200 focus:border-[#1F6B3B] focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/20 disabled:bg-slate-50 disabled:text-slate-500";

const GRAUS_ACADEMICOS = [
  "Ensino Médio",
  "Técnico Médio",
  "Bacharelato",
  "Licenciatura",
  "Pós-Graduação",
  "Mestrado",
  "Doutoramento"
];

const BANCOS = [
  "BAI", "BFA", "BIC", "BPC", "SOL", "ATLANTICO", "KEVE", "VUNJA", "Standard Bank", "Outro"
];

const ACCESS_STATUS_META: Record<AccessStatusKey, { label: string; description: string; badgeClass: string }> = {
  active: {
    label: "Activo",
    description: "Já entrou no portal.",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  created: {
    label: "Criado",
    description: "Aguarda o primeiro acesso.",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  needs_password: {
    label: "Senha temporária",
    description: "Precisa definir senha.",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  pending_confirmation: {
    label: "Pendente",
    description: "Email ainda não confirmado.",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  blocked: {
    label: "Bloqueado",
    description: "Acesso bloqueado no Auth.",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
  },
  unknown: {
    label: "Indefinido",
    description: "Estado não disponível.",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

function getAccessMeta(access?: FormadorAccess) {
  return ACCESS_STATUS_META[access?.status ?? "unknown"];
}

function formatAccessDate(value?: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca";
  return new Intl.DateTimeFormat("pt-AO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function needsAccessAttention(item: FormadorItem) {
  return item.access?.status !== "active";
}

export default function EquipaFormadoresClient() {
  const [items, setItems] = useState<FormadorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [manualAccessLink, setManualAccessLink] = useState<ManualAccessLink | null>(null);

  // Wizard State
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    bi_numero: "",
    nif: "",
    sexo: "",
    grau_academico: "",
    especialidades: [] as string[],
    bio: "",
    banco: "",
    iban: "",
  });

  const [especialidadeInput, setEspecialidadeInput] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FormadorItem>>({});
  const accessActiveCount = items.filter((item) => item.access?.status === "active").length;
  const accessAttentionCount = items.filter(needsAccessAttention).length;

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/formacao/admin/equipa/formadores", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiListResponse | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error || "Falha ao carregar equipa");
      }
      setItems(json.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const validateStep = (s: number) => {
    if (s === 1) return form.nome && form.email;
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(s => s + 1);
    else setError("Por favor, preencha os campos obrigatórios (Nome e Email).");
  };

  const prevStep = () => setStep(s => s - 1);

  const addEspecialidade = () => {
    if (especialidadeInput.trim() && !form.especialidades.includes(especialidadeInput.trim())) {
      setForm(prev => ({
        ...prev,
        especialidades: [...prev.especialidades, especialidadeInput.trim()]
      }));
      setEspecialidadeInput("");
    }
  };

  const removeEspecialidade = (tag: string) => {
    setForm(prev => ({
      ...prev,
      especialidades: prev.especialidades.filter(t => t !== tag)
    }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (step < 3) return nextStep();

    setError(null);
    setSuccess(null);
    setGeneratedPassword(null);
    setManualAccessLink(null);
    setSaving(true);

    try {
      const res = await fetch("/api/formacao/admin/equipa/formadores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => null)) as ApiActionResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao cadastrar formador");
      }

      const baseMessage = json.created_new ? "Formador criado com sucesso." : "Utilizador vinculado com sucesso.";
      const emailMessage =
        json.email_sent === false
          ? ` Email não enviado${json.email_error ? `: ${json.email_error}` : "."}`
          : "";
      setSuccess(`${baseMessage}${emailMessage}`);
      setGeneratedPassword(json.temporary_password ?? null);
      setManualAccessLink(
        json.manual_access_url ? { email: form.email.trim().toLowerCase(), url: json.manual_access_url } : null
      );

      // Reset form
      setForm({
        nome: "", email: "", telefone: "", bi_numero: "", nif: "",
        sexo: "", grau_academico: "", especialidades: [], bio: "",
        banco: "", iban: ""
      });
      setStep(1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (userId: string) => {
    setActionLoading(userId);
    setError(null);
    setSuccess(null);
    setGeneratedPassword(null);
    setManualAccessLink(null);

    try {
      const res = await fetch("/api/formacao/admin/equipa/formadores", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, ...editForm }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Erro ao atualizar");

      setSuccess("Dados atualizados com sucesso.");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendAccess = async (item: FormadorItem) => {
    if (!item.email) {
      setError("Este formador não tem email configurado.");
      return;
    }

    setActionLoading(`access:${item.user_id}`);
    setError(null);
    setSuccess(null);
    setGeneratedPassword(null);
    setManualAccessLink(null);

    try {
      const res = await fetch("/api/formacao/admin/equipa/formadores", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: item.user_id, reset_password: true }),
      });
      const json = (await res.json().catch(() => null)) as ApiActionResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao reenviar acesso");
      }

      if (json.email_sent) {
        setSuccess(`Acesso reenviado para ${item.email}.`);
      } else {
        setSuccess(`Senha temporária gerada, mas o email não foi enviado${json.email_error ? `: ${json.email_error}` : "."}`);
        setGeneratedPassword(json.temporary_password ?? null);
        if (json.manual_access_url) {
          setManualAccessLink({ email: item.email, url: json.manual_access_url });
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reenviar acesso");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Remover este formador da equipa?")) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/formacao/admin/equipa/formadores?userId=${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover");
      setSuccess("Vínculo removido.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setActionLoading(null);
    }
  };

  const copyManualAccessLink = async () => {
    if (!manualAccessLink) return;

    try {
      await navigator.clipboard.writeText(manualAccessLink.url);
      setSuccess(`Link de acesso copiado para ${manualAccessLink.email}.`);
      setError(null);
    } catch {
      setError("Não foi possível copiar o link automaticamente.");
    }
  };

  return (
    <div className="grid gap-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">gestão · equipa</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">Formadores</h1>
          </div>
        </div>
      </header>

      {/* Cadastro Wizard */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={`flex flex-1 items-center justify-center gap-2 py-4 text-xs font-bold transition-colors ${step === i ? "bg-slate-50 text-[#C8902A]" : "text-slate-400"}`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${step === i ? "border-[#C8902A]" : "border-slate-200"}`}>{i}</span>
              <span className="hidden sm:inline">
                {i === 1 && "Identidade"}
                {i === 2 && "Profissional"}
                {i === 3 && "Financeiro"}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="p-6">
          {step === 1 && (
            <div className="grid gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 text-[#C8902A]">
                <User className="h-4 w-4" />
                <h2 className="text-sm font-bold">Dados de Acesso e Identidade</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Nome Completo *</label>
                  <input className={inputClass} value={form.nome} onChange={e => setForm(p => ({...p, nome: e.target.value}))} required />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Email Profissional *</label>
                  <input className={inputClass} type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} required />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Telefone</label>
                  <input className={inputClass} value={form.telefone} onChange={e => setForm(p => ({...p, telefone: e.target.value}))} />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Gênero</label>
                  <select className={inputClass} value={form.sexo} onChange={e => setForm(p => ({...p, sexo: e.target.value}))}>
                    <option value="">Selecionar...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">BI (Bilhete de Identidade)</label>
                  <input className={inputClass} placeholder="000000000XX000" value={form.bi_numero} onChange={e => setForm(p => ({...p, bi_numero: e.target.value.toUpperCase()}))} />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">NIF (se diferente do BI)</label>
                  <input className={inputClass} value={form.nif} onChange={e => setForm(p => ({...p, nif: e.target.value}))} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 text-[#C8902A]">
                <Briefcase className="h-4 w-4" />
                <h2 className="text-sm font-bold">Perfil Profissional</h2>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Grau Académico</label>
                  <select className={inputClass} value={form.grau_academico} onChange={e => setForm(p => ({...p, grau_academico: e.target.value}))}>
                    <option value="">Selecionar...</option>
                    {GRAUS_ACADEMICOS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Especialidades / Áreas que leciona</label>
                  <div className="flex gap-2">
                    <input
                      className={`${inputClass} flex-1`}
                      placeholder="Ex: Gestão de Projetos"
                      value={especialidadeInput}
                      onChange={e => setEspecialidadeInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEspecialidade())}
                    />
                    <button type="button" onClick={addEspecialidade} className="rounded-lg bg-slate-100 px-3 text-slate-600 hover:bg-slate-200"><Tag className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.especialidades.map(tag => (
                      <span key={tag} className="flex items-center gap-1 rounded-full bg-[#C8902A]/10 px-2.5 py-1 text-[10px] font-bold text-[#C8902A]">
                        {tag}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeEspecialidade(tag)} />
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Resumo Biográfico (Bio)</label>
                  <textarea className={`${inputClass} min-h-[100px]`} value={form.bio} onChange={e => setForm(p => ({...p, bio: e.target.value}))} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 text-[#C8902A]">
                <Wallet className="h-4 w-4" />
                <h2 className="text-sm font-bold">Dados Financeiros (para Honorários)</h2>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Banco</label>
                  <select className={inputClass} value={form.banco} onChange={e => setForm(p => ({...p, banco: e.target.value}))}>
                    <option value="">Selecionar...</option>
                    {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">IBAN (21 dígitos)</label>
                  <input
                    className={`${inputClass} font-mono`}
                    placeholder="AO06 0000 0000 0000 0000 0"
                    value={form.iban}
                    maxLength={25}
                    onChange={e => setForm(p => ({...p, iban: e.target.value.toUpperCase().replace(/\s/g, "")}))}
                  />
                  <p className="text-[10px] text-slate-400">Certifique-se que o IBAN está correto para evitar falhas nos pagamentos.</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between border-t border-slate-100 pt-6">
            {step > 1 ? (
              <button type="button" onClick={prevStep} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
            ) : <div />}

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#C8902A] px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#B07E21]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 3 ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {saving ? "A processar..." : step === 3 ? "Finalizar Cadastro" : "Próximo"}
            </button>
          </div>
        </form>
      </div>

      {/* Feedbacks */}
      <div className="grid gap-3">
        {error && <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
        {success && <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />{success}</div>}
        {generatedPassword && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <span className="font-bold">Senha temporária:</span>{" "}
            <code className="rounded bg-white/70 px-2 py-1 font-mono text-xs">{generatedPassword}</code>
          </div>
        )}
        {manualAccessLink && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="font-bold">Link manual de acesso</p>
                <p className="mt-1 text-xs text-amber-800">
                  Envie este link para {manualAccessLink.email} definir a senha.
                </p>
                <code className="mt-2 block max-w-full overflow-x-auto rounded bg-white/70 px-2 py-2 font-mono text-[11px]">
                  {manualAccessLink.url}
                </code>
              </div>
              <button
                type="button"
                onClick={copyManualAccessLink}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white/70 px-3 py-2 text-xs font-bold text-amber-900 transition hover:bg-white"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </button>
            </div>
          </div>
        )}
      </div>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B]/10 text-[#1F6B3B]">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">acessos do portal</p>
            <h2 className="text-sm font-black text-slate-900">Formadores com login activo</h2>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Activos</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{accessActiveCount}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">A requerer acção</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{accessAttentionCount}</p>
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Equipa ({items.length})</h2>
          <button onClick={load} className="text-xs text-slate-500 hover:text-[#C8902A]">Atualizar</button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center text-slate-400"><Loader2 className="h-8 w-8 animate-spin" /><p className="text-[10px] mt-2 font-bold uppercase">A carregar...</p></div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-slate-700">Nenhum formador cadastrado.</p>
            <p className="mt-1 text-xs text-slate-500">Cadastre o primeiro formador para criar o acesso ao portal.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(item => {
              const accessMeta = getAccessMeta(item.access);
              const accessBusy = actionLoading === `access:${item.user_id}`;

              return (
                <div key={item.user_id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500">{item.nome.charAt(0)}</div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{item.nome}</h3>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="flex items-center gap-1 text-[11px] text-slate-500"><Mail className="h-3 w-3" />{item.email ?? "sem email"}</span>
                          {item.telefone && <span className="flex items-center gap-1 text-[11px] text-slate-500"><Phone className="h-3 w-3" />{item.telefone}</span>}
                          {item.grau_academico && <span className="flex items-center gap-1 text-[11px] text-slate-500"><GraduationCap className="h-3 w-3" />{item.grau_academico}</span>}
                        </div>
                        {item.especialidades && item.especialidades.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.especialidades.map(tag => <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{tag}</span>)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm lg:min-w-[310px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${accessMeta.badgeClass}`}>
                          {accessMeta.label}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          Último acesso: {formatAccessDate(item.access?.last_sign_in_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{accessMeta.description}</p>
                      {item.access?.error ? (
                        <p className="text-[11px] text-amber-700">Estado parcial: {item.access.error}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleResendAccess(item)}
                          disabled={accessBusy || !item.email}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#1F6B3B]/20 bg-[#1F6B3B]/10 px-3 py-2 text-xs font-bold text-[#1F6B3B] transition hover:bg-[#1F6B3B]/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {accessBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
                          Reenviar acesso
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingId(item.user_id); setEditForm(item); }}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.user_id)}
                          disabled={actionLoading === item.user_id}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>

                  {editingId === item.user_id && (
                    <div className="mt-4 grid gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <span className="text-xs font-bold text-slate-800">Editar Perfil Completo</span>
                        <X className="h-4 w-4 cursor-pointer" onClick={() => setEditingId(null)} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-1">
                          <label className="text-[10px] font-bold text-slate-400">NOME</label>
                          <input className={inputClass} value={editForm.nome} onChange={e => setEditForm(p => ({...p, nome: e.target.value}))} />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-[10px] font-bold text-slate-400">TELEFONE</label>
                          <input className={inputClass} value={editForm.telefone || ""} onChange={e => setEditForm(p => ({...p, telefone: e.target.value}))} />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-[10px] font-bold text-slate-400">BI</label>
                          <input className={inputClass} value={editForm.bi_numero || ""} onChange={e => setEditForm(p => ({...p, bi_numero: e.target.value}))} />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-[10px] font-bold text-slate-400">IBAN</label>
                          <input className={inputClass} value={editForm.iban || ""} onChange={e => setEditForm(p => ({...p, iban: e.target.value}))} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingId(null)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50">Cancelar</button>
                        <button
                          onClick={() => handleUpdate(item.user_id)}
                          disabled={actionLoading === item.user_id}
                          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          {actionLoading === item.user_id ? "A guardar..." : "Guardar Alterações"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
