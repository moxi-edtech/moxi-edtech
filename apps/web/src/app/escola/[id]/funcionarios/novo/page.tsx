"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { ArrowLeftIcon, UserPlusIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

type Papel = "admin" | "staff_admin" | "secretaria" | "financeiro" | "professor";

export default function NovoFuncionarioPage() {
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

  const handleChange = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!form.nome.trim()) return setMsg({ ok: false, text: "Informe o nome." });
    if (!form.email.trim()) return setMsg({ ok: false, text: "Informe o email." });
    try {
      setSubmitting(true);
      const res = await fetch(`/api/escolas/${escolaId}/usuarios/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          telefone: form.telefone.trim() || null,
          papel: form.papel,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao criar funcionário");
      
      const { numero_login, senha_temp } = json as { numero_login?: string; senha_temp?: string };
      
      let successText = "Funcionário convidado com sucesso!";
      if (numero_login) {
        successText += ` Número de login: ${numero_login}.`;
      }
      if (senha_temp) {
        successText += ` Senha temporária: ${senha_temp}.`;
      }
      
      setMsg({ ok: true, text: successText });
      // Não redireciona automaticamente para permitir copiar credenciais
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setMsg({ ok: false, text: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-moxinexa-teal transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Voltar
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-moxinexa-teal rounded-full mb-3">
            <UserPlusIcon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-moxinexa-dark">Cadastrar Funcionário</h1>
          <p className="text-moxinexa-gray mt-1">Convide secretaria, financeiro ou administradores da escola</p>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-6 border border-gray-100 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
              <input
                value={form.nome}
                onChange={e => handleChange("nome", e.target.value)}
                placeholder="Ex: Maria Souza"
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                disabled={submitting}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => handleChange("email", e.target.value)}
                placeholder="Ex: maria@escola.com"
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                value={form.telefone}
                onChange={e => handleChange("telefone", e.target.value)}
                placeholder="Ex: (11) 99999-9999"
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Papel *</label>
              <select
                value={form.papel}
                onChange={e => handleChange("papel", e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                disabled={submitting}
              >
                <option value="secretaria">Secretaria</option>
                <option value="financeiro">Financeiro</option>
                <option value="staff_admin">Staff Admin</option>
                <option value="admin">Administrador</option>
                <option value="professor">Professor</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Para Secretaria, será gerado um número de login automático.</p>
            </div>
          </div>

          {msg && (
            <div className={`p-3 rounded-lg border text-sm ${msg.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
              <div className="flex items-center gap-2">
                {msg.ok ? <CheckCircleIcon className="w-5 h-5" /> : <ExclamationTriangleIcon className="w-5 h-5" />}
                <span>{msg.text}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" tone="gray" onClick={() => router.back()}>
              Voltar
            </Button>
            <Button type="submit" tone="teal" disabled={submitting}>
              {submitting ? "Enviando Convite..." : "Convidar Funcionário"}
            </Button>
          </div>
        </form>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
          • O convidado receberá um e-mail com instruções de acesso, incluindo uma senha temporária. Para Secretaria, também enviamos o número de login.
        </div>
      </div>
    </div>
  );
}
