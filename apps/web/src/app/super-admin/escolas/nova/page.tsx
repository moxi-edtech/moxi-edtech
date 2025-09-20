// apps/web/src/app/super-admin/escolas/nova/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";

export default function NovaEscolaPage() {
  return (
    <RequireSuperAdmin>
      <CriarEscolaForm />
    </RequireSuperAdmin>
  );
}

function CriarEscolaForm() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [nif, setNif] = useState("");
  const [endereco, setEndereco] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminTelefone, setAdminTelefone] = useState("");
  const [adminNome, setAdminNome] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<null | { type: "ok" | "err"; text: string }>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    try {
      setLoading(true);

      // Chama a API com os dados normalizados
      const res = await fetch("/api/escolas/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          nif: nif || null,
          endereco: endereco || null,
          admin: {
            email: adminEmail || null,
            telefone: adminTelefone || null,
            nome: adminNome || null,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Erro desconhecido ao criar escola.");
      }

      setMsg({
        type: "ok",
        text: `Escola "${nome}" criada com sucesso! Redirecionando para o onboarding...`,
      });

      // Redireciona imediatamente para o onboarding
      router.push(`/escola/${data.escolaId}/onboarding`);
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || String(err) });
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
            NIF <span className="text-gray-400">(Obrigatório)</span>
          </label>
          <input
            className="border rounded-md w-full p-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="9 dígitos (apenas números)"
            value={nif}
            onChange={(e) => setNif(e.target.value)}
            maxLength={9}
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
                Nome do Administrador <span className="text-gray-400">(Obrigatório)</span>
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
                maxLength={9}
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
