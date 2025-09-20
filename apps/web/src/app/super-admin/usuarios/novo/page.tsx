"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";
import { createClient } from "@/lib/supabaseClient";
import type { Database } from "~types/supabase";

export default function Page() {
  return (
    <RequireSuperAdmin>
      <CriarUsuarioForm />
    </RequireSuperAdmin>
  );
}

function CriarUsuarioForm() {
  const supabase = createClient();
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [papel, setPapel] = useState("diretor");
  const roleMap: Record<string, Database["public"]["Enums"]["user_role"]> = {
    diretor: "admin",
    administrador: "admin",
    financeiro: "financeiro",
    secretario: "secretaria",
  };
  const [escolaId, setEscolaId] = useState("");

  const [escolas, setEscolas] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<null | { type: "ok" | "err"; text: string }>(null);

  // Carregar escolas existentes
  useEffect(() => {
    const fetchEscolas = async () => {
      const { data, error } = await supabase
        .from("escolas")
        .select("id, nome")
        .order("nome", { ascending: true });

      if (!error && data) setEscolas(data);
    };
    fetchEscolas();
  }, [supabase]);

  const validar = () => {
    if (!nome.trim()) return "Informe o nome.";
    if (!email.trim()) return "Informe o email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email inválido.";
    if (!escolaId) return "Selecione uma escola.";
    if (tempPassword) {
      const err = validatePassword(tempPassword)
      if (err) return `Senha temporária: ${err}`
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const erro = validar();
    if (erro) {
      setMsg({ type: "err", text: erro });
      return;
    }

    try {
      setLoading(true);

      const roleEnum = roleMap[papel];
      const res = await fetch("/api/super-admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, telefone, papel, escolaId, roleEnum, tempPassword: tempPassword || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao criar usuário");

      setMsg({
        type: "ok",
        text: `✅ Usuário criado. Senha temporária: ${json.tempPassword || '(gerada)'}`,
      });

      setTimeout(() => { router.push("/super-admin/usuarios"); }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Erro ao criar usuário:", err);
      setMsg({ type: "err", text: `Erro: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Criar Usuário Global</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-white rounded-lg shadow p-6"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Nome *</label>
          <input
            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-moxinexa-teal"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">Senha temporária (opcional)</label>
            <span
              className="text-xs text-gray-500 cursor-help"
              title={
                'Requisitos: mínimo 8 caracteres, com ao menos 1 letra maiúscula, 1 letra minúscula, 1 número e 1 caractere especial.'
              }
            >
              ℹ️ Requisitos
            </span>
          </div>
          <input
            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-moxinexa-teal"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            disabled={loading}
            placeholder="Deixe em branco para gerar automaticamente"
          />
          <p className="mt-1 text-xs text-gray-500">
            Mín. 8, com maiúscula, minúscula, número e caractere especial.
          </p>
          {tempPassword && (
            <div className="mt-2">
              <PasswordStrength pwd={tempPassword} />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            type="email"
            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-moxinexa-teal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Telefone</label>
          <input
            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-moxinexa-teal"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Papel *</label>
          <select
            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-moxinexa-teal"
            value={papel}
            onChange={(e) => setPapel(e.target.value)}
            disabled={loading}
          >
            <option value="diretor">Diretor</option>
            <option value="administrador">Administrador</option>
            <option value="financeiro">Financeiro</option>
            <option value="secretario">Secretário</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Escola *</label>
          <select
            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-moxinexa-teal"
            value={escolaId}
            onChange={(e) => setEscolaId(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">Selecione uma escola...</option>
            {escolas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-moxinexa-teal text-white py-2 rounded-lg hover:bg-moxinexa-teal-dark disabled:opacity-50"
        >
          {loading ? "⏳ Criando..." : "👤 Criar Usuário"}
        </button>

        {msg && (
          <div
            className={`mt-4 p-3 rounded-md ${
              msg.type === "ok"
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {msg.text}
          </div>
        )}
      </form>
    </div>
  );
}

function passwordRules(pwd: string) {
  return [
    { ok: pwd.length >= 8, msg: 'Pelo menos 8 caracteres' },
    { ok: /[A-Z]/.test(pwd), msg: '1 letra maiúscula' },
    { ok: /[a-z]/.test(pwd), msg: '1 letra minúscula' },
    { ok: /\d/.test(pwd), msg: '1 número' },
    { ok: /[^A-Za-z0-9]/.test(pwd), msg: '1 caractere especial' },
  ]
}

function validatePassword(pwd: string) {
  const fail = passwordRules(pwd).find(r => !r.ok)
  return fail?.msg || null
}

function PasswordStrength({ pwd }: { pwd: string }) {
  const rules = passwordRules(pwd)
  const score = rules.filter(r => r.ok).length
  let label = 'Muito fraca'
  let color = 'bg-red-500'
  if (score === 2) { label = 'Fraca'; color = 'bg-amber-500' }
  if (score === 3) { label = 'Média'; color = 'bg-yellow-500' }
  if (score === 4) { label = 'Forte'; color = 'bg-green-600' }
  if (score >= 5) { label = 'Excelente'; color = 'bg-moxinexa-teal' }

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-600">Força da senha:</span>
        <span className="font-medium text-gray-800">{label}</span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {[0,1,2,3,4].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded ${i < score ? color : 'bg-gray-200'}`}></div>
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
        {rules.map((r, idx) => (
          <li key={idx} className={r.ok ? 'text-green-600' : 'text-gray-500'}>
            {r.ok ? '✓' : '•'} {r.msg}
          </li>
        ))}
      </ul>
    </div>
  )
}
