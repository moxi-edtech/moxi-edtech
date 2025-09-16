// apps/web/src/app/super-admin/escolas/nova/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";
import { createClient } from "@/lib/supabaseClient";
import type { Database } from "@/types/supabase";

export default function NovaEscolaPage() {
  return (
    <RequireSuperAdmin>
      <CriarEscolaForm />
    </RequireSuperAdmin>
  );
}

function CriarEscolaForm() {
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome] = useState("");
  const [nif, setNif] = useState("");
  const [endereco, setEndereco] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminTelefone, setAdminTelefone] = useState("");
  const [adminNome, setAdminNome] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<null | { type: "ok" | "err"; text: string }>(null);

  const validar = () => {
    if (!nome.trim()) return "Informe o nome da escola.";
    if (nif) {
      const onlyDigits = nif.replace(/\D/g, "");
      if (!/^\d{9}$/.test(onlyDigits)) return "NIF inválido. Use 9 dígitos (apenas números).";
    }
    if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))
      return "Email do administrador inválido.";
    if (adminTelefone) {
      const onlyDigits = adminTelefone.replace(/\D/g, "");
      // Angola: 9XXXXXXXX (9 dígitos iniciando com 9)
      if (!/^9\d{8}$/.test(onlyDigits)) return "Telefone inválido. Use o formato 9XXXXXXXX (9 dígitos).";
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

      // Normaliza NIF e telefone (somente números)
      const cleanNif = nif ? nif.replace(/\D/g, "") : null;
      const cleanTelefone = adminTelefone ? adminTelefone.replace(/\D/g, "") : null;

      // 1) Criar a escola com onboarding_finalizado = false
      const { data: escola, error: escolaError } = await supabase
        .from("escolas")
        .insert([
          {
            nome: nome.trim(),
            nif: cleanNif,
            endereco: endereco || null,
            status: "ativa",
            cor_primaria: null,
            onboarding_finalizado: false, // 👈 força o fluxo de onboarding
          },
        ])
        .select()
        .single();

      if (escolaError) {
        const dup = (escolaError as { code?: string })?.code === "23505";
        throw new Error(dup ? "Já existe uma escola com este NIF." : escolaError.message);
      }

      // 2) Vincular administrador (opcional)
      let mensagemAdmin = "";
      if (adminEmail.trim()) {
        try {
          // Busca usuário existente pelo email
          const { data: usuario, error: userError } = await supabase
            .from("profiles")
            .select("user_id, email, telefone, nome, role, escola_id")
            .eq("email", adminEmail.trim().toLowerCase())
            .maybeSingle();

          if (userError) throw userError;

          if (usuario?.user_id) {
            // Atualiza dados do profile (telefone/nome e, se desejar, role/escola_id)
            const updates: Database["public"]["Tables"]["profiles"]["Update"] = {};
            if (adminTelefone) updates.telefone = cleanTelefone;
            if (adminNome) updates.nome = adminNome.trim();
            // ⚠️ Define papel do usuário como admin escolar
            updates.role = "admin" as Database["public"]["Enums"]["user_role"];
            if (!usuario.escola_id) updates.escola_id = escola.id;

            if (Object.keys(updates).length > 0) {
              const { error: updErr } = await supabase
                .from("profiles")
                .update(updates)
                .eq("user_id", usuario.user_id);
              if (updErr) console.warn("Falha ao atualizar profile:", updErr.message);
            }

            // Registra vínculo na tabela de administradores da escola
            const { error: adminError } = await supabase
              .from("escola_administradores")
              .insert([
                {
                  escola_id: escola.id,
                  user_id: usuario.user_id,
                  cargo: "administrador_principal",
                },
              ]);

            if (adminError) {
  console.error("Erro ao vincular administrador:", JSON.stringify(adminError, null, 2));
  mensagemAdmin = ` ⚠️ Administrador não vinculado (erro técnico).`;
} else {
  mensagemAdmin = ` ✅ Administrador vinculado: ${adminEmail}`;
  if (adminTelefone) mensagemAdmin += ` | Tel: ${adminTelefone}`;
  if (adminNome) mensagemAdmin += ` | Nome: ${adminNome}`;
}

            // Usuário não existe nos profiles
            mensagemAdmin = ` ⚠️ Usuário não encontrado. Vincule manualmente depois.`;
          }
        } catch (adminErr) {
          console.error("Erro no vínculo do admin:", JSON.stringify(adminErr, null, 2));
          mensagemAdmin = ` ⚠️ Erro ao vincular administrador.`;
        }
      }

      // 3) Mensagem de sucesso + redirecionamento para onboarding
      setMsg({
        type: "ok",
        text: `Escola "${escola.nome}" criada com sucesso! Redirecionando para o onboarding...${mensagemAdmin}`,
      });

      setTimeout(() => {
        // Leva direto ao fluxo de onboarding da escola recém-criada
        router.push(`/escola/${escola.id}/onboarding`);
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setMsg({ type: "err", text: `Erro ao criar escola: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Criar Nova Escola</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg shadow p-6">
        <div>
          <label className="block text-sm font-medium mb-1">Nome da Escola *</label>
          <input
            className="border rounded-md w-full p-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex.: Colégio Horizonte"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            NIF <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            className="border rounded-md w-full p-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="9 dígitos (apenas números)"
            value={nif}
            onChange={(e) => setNif(e.target.value)}
            maxLength={14}
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">Se informado, deve ser único (9 dígitos).</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Endereço <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            className="border rounded-md w-full p-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Rua, nº, bairro, cidade"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* SEÇÃO DO ADMINISTRADOR */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-medium mb-3">Administrador da Escola</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Nome do Administrador <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                className="border rounded-md w-full p-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nome completo"
                value={adminNome}
                onChange={(e) => setAdminNome(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Email do Administrador <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                className="border rounded-md w-full p-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@escola.com"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Telefone do Administrador <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                className="border rounded-md w-full p-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="9XXXXXXXX (ex: 923456789)"
                value={adminTelefone}
                onChange={(e) => setAdminTelefone(e.target.value)}
                maxLength={13}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Formato: 9XXXXXXXX (9 dígitos iniciando por 9).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-md border hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "⏳ Criando..." : "🏫 Criar Escola"}
          </button>
        </div>

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

      <div className="mt-6 text-sm text-gray-600">
        💡 Ao criar a escola, o fluxo de onboarding será iniciado para completar a configuração inicial.
      </div>
    </div>
  );
}
