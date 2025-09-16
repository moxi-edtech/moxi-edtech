// apps/web/src/app/super-admin/escolas/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import Sidebar from "@/components/super-admin/Sidebar";
import Header from "@/components/super-admin/Header";
import ChartsSection from "@/components/super-admin/ChartsSection";
import ActivitiesSection from "@/components/super-admin/ActivitiesSection";
import QuickActionsSection from "@/components/super-admin/QuickActionsSection";

import {
  AcademicCapIcon,
  UsersIcon,
  BanknotesIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

type EscolaDetalhes = {
  id: string | number;
  nome: string;
  status: string;
  plano: string;
  cidade: string;
  estado: string;
  total_alunos: number;
  total_professores: number;
  notas_lancadas: number;
  pagamentos_em_dia: number;
  ultimo_acesso: string | null;
};

// 🔹 fallback mock
const mockEscola: EscolaDetalhes = {
  id: "mock-1",
  nome: "Escola Mock de Teste",
  status: "ativa",
  plano: "Premium",
  cidade: "São Paulo",
  estado: "SP",
  total_alunos: 1200,
  total_professores: 58,
  notas_lancadas: 80,
  pagamentos_em_dia: 92,
  ultimo_acesso: null,
};

export default function EscolaDetalhesPage() {
  const params = useParams();
  const supabase = createClient();

  const [escola, setEscola] = useState<EscolaDetalhes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        // se params.id vier como string (Next.js retorna sempre string)
        const escolaId = Array.isArray(params.id) ? params.id[0] : params.id;

        // Buscar dados básicos da escola diretamente da tabela
        const { data, error } = await supabase
          .from("escolas")
          .select("id, nome, status, endereco")
          .eq("id", String(escolaId))
          .single();

        if (!error && data && active) {
          const e = data as { id: string; nome: string; status: string | null; endereco: string | null }
          // Monta detalhes com placeholders
          setEscola({
            id: e.id,
            nome: e.nome,
            status: e.status ?? "ativa",
            plano: "Básico",
            cidade: e.endereco ?? "",
            estado: "",
            total_alunos: 0,
            total_professores: 0,
            notas_lancadas: 0,
            pagamentos_em_dia: 0,
            ultimo_acesso: null,
          });
        } else {
          console.warn("⚠️ Nenhuma escola encontrada, usando mock");
          setEscola(mockEscola);
        }
      } catch (e) {
        console.error("❌ Erro ao buscar escola:", e);
        setEscola(mockEscola);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [params.id, supabase]);

  if (loading) {
    return <p className="p-6">Carregando dados da escola...</p>;
  }

  if (!escola) {
    return <p className="p-6">Escola não encontrada.</p>;
  }

  const kpis = [
    { title: "Alunos", value: escola.total_alunos, icon: UsersIcon },
    { title: "Professores", value: escola.total_professores, icon: UserGroupIcon },
    { title: "Notas Lançadas", value: `${escola.notas_lancadas}%`, icon: AcademicCapIcon },
    { title: "Pagamentos em Dia", value: `${escola.pagamentos_em_dia}%`, icon: BanknotesIcon },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="p-6 overflow-y-auto space-y-6">
          <h1 className="text-2xl font-bold">
            {escola.nome} ({escola.cidade} - {escola.estado})
          </h1>
          <p className="text-gray-500">
            Plano: {escola.plano} · Status: {escola.status}
          </p>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi) => (
              <div
                key={kpi.title}
                className="bg-white shadow rounded-lg p-4 flex items-center"
              >
                <kpi.icon className="w-10 h-10 text-blue-600 mr-4" />
                <div>
                  <p className="text-sm text-gray-500">{kpi.title}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Section - dados locais da escola */}
          <ChartsSection escolaId={String(escola.id)} />

          {/* Activities e QuickActions */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ActivitiesSection activities={[]} />
            </div>
            <div className="lg:col-span-1">
              <QuickActionsSection />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
