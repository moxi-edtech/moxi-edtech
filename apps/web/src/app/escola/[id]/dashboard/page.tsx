// apps/web/src/app/escola/[id]/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function EscolaDashboard() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  type EscolaRow = import("@/types/supabase").Database["public"]["Tables"]["escolas"]["Row"]
  const [escola, setEscola] = useState<EscolaRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEscola = async () => {
      if (!id) {
        console.error("❌ Nenhum ID recebido na rota.");
        setLoading(false);
        return;
      }

      // 🔑 Verifica usuário logado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("❌ Erro ao buscar usuário:", userError.message);
      } else {
        console.log("🔑 Usuário logado:", user);
      }

      console.log("🔎 ID recebido no dashboard:", id);

      const { data, error } = await supabase
        .from("escolas")
        .select("*")
        .eq("id", id)
        .maybeSingle<EscolaRow>();

      if (error) {
        console.error("❌ Erro ao buscar escola:", error.message, error);
      } else if (!data) {
        console.warn("⚠️ Nenhuma escola encontrada com esse ID:", id);
      } else {
        console.log("✅ Escola carregada:", data);
        setEscola(data);
      }

      setLoading(false);
    };

    fetchEscola();
  }, [id, supabase]);

  if (loading) {
    return <div className="p-6">⏳ Carregando dados da escola...</div>;
  }

  if (!escola) {
    return (
      <div className="p-6 text-red-600">
        ❌ Escola não encontrada. Verifique o ID ou permissões de acesso.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-moxinexa-dark">
        Dashboard da Escola: {escola.nome}
      </h1>

      <p className="text-gray-500 mt-1">
        Status:{" "}
        <span className="font-medium text-moxinexa-teal">{escola.status}</span>
      </p>

      <div className="mt-6">
        <button className="px-4 py-2 rounded-lg bg-moxinexa-teal text-white hover:bg-moxinexa-teal-dark transition">
          Criar nova turma
        </button>
      </div>
    </div>
  );
}
