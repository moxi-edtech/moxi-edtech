"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";
import { createClient } from "@/lib/supabaseClient";
import type { Database } from "@/types/supabase";

export default function NovoUsuarioPage() {
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

      // 1. Criar usuário no Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: Math.random().toString(36).slice(-10), // senha temporária
        email_confirm: false,
      });

      if (authError) throw authError;
      if (!authUser?.user) throw new Error("Falha ao criar usuário no Auth");

      // 2. Criar perfil global
      const roleEnum = roleMap[papel];
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          user_id: authUser.user.id,
          email: email.trim().toLowerCase(),
          nome: nome.trim(),
          telefone: telefone || null,
          role: roleEnum, // mapped to enum
        },
      ]);

      if (profileError) throw profileError;

      // 3. Criar vínculo com escola
      const { error: vinculoError } = await supabase.from("escola_usuarios").insert([
        {
          escola_id: escolaId,
          user_id: authUser.user.id,
          papel,
        },
      ]);

      if (vinculoError) throw vinculoError;

      setMsg({
        type: "ok",
        text: `✅ Usuário criado com sucesso (${papel}) na escola selecionada.`,
      });

      setTimeout(() => {
        router.push("/super-admin/usuarios");
      }, 2000);
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
