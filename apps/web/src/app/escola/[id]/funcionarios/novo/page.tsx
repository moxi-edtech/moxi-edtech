"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeftIcon,
  UserPlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";

type Papel = "admin" | "staff_admin" | "secretaria" | "financeiro" | "secretaria_financeiro" | "admin_financeiro";

export default function NovoFuncionarioPage({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const p = useParams() as Record<string, string | string[] | undefined>;
  const escolaId = useMemo(() => (Array.isArray(p.id) ? p.id[0] : (p.id ?? "")), [p.id]);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    papel: "secretaria" as Papel,
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<null | { ok: boolean; text: string }>(null);
  const [credentials, setCredentials] = useState<null | {
    email: string;
    senha?: string | null;
    numero_login?: string | null;
  }>(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setCopied(false);
    setCredentials(null);
    if (!form.nome.trim()) return setMsg({ ok: false, text: "Informe o nome." });
    if (!form.email.trim()) return setMsg({ ok: false, text: "Informe o email." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      return setMsg({ ok: false, text: "Informe um email válido." });
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/escolas/${escolaId}/usuarios/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          telefone: form.telefone.replace(/\D/g, "") || null,
          papel: form.papel,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao criar funcionário");

      const { numero_login, senha_temp } = json as { numero_login?: string; senha_temp?: string };

      setCredentials({
        email: form.email.trim().toLowerCase(),
        senha: senha_temp,
        numero_login,
      });
      setMsg({ ok: true, text: "Funcionário criado com sucesso!" });
      // Não redireciona automaticamente para permitir copiar credenciais
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setMsg({ ok: false, text: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${embedded ? "" : "min-h-screen bg-gray-50"}`}>
      <div className={`${embedded ? "" : "max-w-2xl mx-auto px-4 py-8"}`}>
        {!embedded && (
          <div className="flex border-b border-slate-200 mb-6">
            {["novo", "funcionarios"].map((tab) => (
              <Link
                key={tab}
                href={
                  tab === "funcionarios" ? `/escola/${escolaId}/funcionarios` : `/escola/${escolaId}/funcionarios/novo`
                }
                className={`px-6 py-3 font-medium relative ${
                  tab === "novo" ? "text-klasse-gold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab === "novo" ? "Cadastrar" : "Funcionários"}
                {tab === "novo" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-klasse-gold" />
                )}
              </Link>
            ))}
          </div>
        )}
        {!embedded && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-klasse-green transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Voltar
            </button>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-klasse-green rounded-full mb-3">
            <UserPlusIcon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastrar Funcionário</h1>
          <p className="text-slate-500 mt-1">Crie secretaria, financeiro ou administradores da escola</p>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-6 border border-slate-200 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo *</label>
              <input
                value={form.nome}
                onChange={e => handleChange("nome", e.target.value)}
                placeholder="Ex: Maria Souza"
                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                disabled={submitting}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => handleChange("email", e.target.value)}
                placeholder="Ex: maria@escola.com"
                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input
                value={form.telefone}
                onChange={e => handleChange("telefone", formatPhone(e.target.value))}
                placeholder="Ex: (11) 99999-9999"
                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                disabled={submitting}
                inputMode="tel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Papel *</label>
              <select
                value={form.papel}
                onChange={e => handleChange("papel", e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
                disabled={submitting}
              >
                <option value="secretaria">Secretaria</option>
                <option value="financeiro">Financeiro</option>
                <option value="secretaria_financeiro">Secretaria + Financeiro</option>
                <option value="admin_financeiro">Admin + Financeiro</option>
                <option value="staff_admin">Staff Admin</option>
                <option value="admin">Administrador</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Para Secretaria, será gerado um número de login automático.</p>
            </div>
          </div>

          {msg && (
            <div className={`p-3 rounded-xl border text-sm ${msg.ok ? "bg-klasse-green/10 border-klasse-green/20 text-klasse-green" : "bg-red-50 border-red-200 text-red-800"}`}>
              <div className="flex items-center gap-2">
                {msg.ok ? <CheckCircleIcon className="w-5 h-5" /> : <ExclamationTriangleIcon className="w-5 h-5" />}
                <span>{msg.text}</span>
              </div>
            </div>
          )}

          {credentials && (
            <div className="rounded-xl border border-klasse-green/20 bg-klasse-green/10 p-4 text-sm text-klasse-green">
              <div className="flex items-center gap-2 font-semibold">
                <ClipboardDocumentCheckIcon className="h-4 w-4" />
                Credenciais geradas
              </div>
              <div className="mt-2 space-y-1">
                <div>Email: {credentials.email}</div>
                <div>Senha temporária: {credentials.senha || "—"}</div>
                <div>Número de login: {credentials.numero_login || "—"}</div>
              </div>
              <button
                type="button"
                className="mt-3 rounded-lg border border-klasse-green/30 bg-white px-3 py-1 text-xs font-semibold text-klasse-green"
                onClick={async () => {
                  const payload = `Email: ${credentials.email}\nSenha temporária: ${credentials.senha || ""}\nNúmero de login: ${credentials.numero_login || ""}`.trim();
                  try {
                    await navigator.clipboard.writeText(payload);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Credenciais copiadas" : "Copiar credenciais"}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" tone="gray" onClick={() => router.back()}>
              Voltar
            </Button>
            <Button type="submit" tone="gold" disabled={submitting}>
              {submitting ? "Criando Funcionário..." : "Criar Funcionário"}
            </Button>
          </div>
        </form>

        <div className="mt-6 rounded-xl border border-klasse-gold/20 bg-klasse-gold/10 p-4 text-sm text-klasse-gold">
          • Após criar, copie o e-mail e a senha temporária exibidos acima. Para Secretaria, também exibimos o número de login.
        </div>
      </div>
    </div>
  );
}
