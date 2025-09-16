// apps/web/src/app/super-admin/escolas/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import type { Database } from "@/types/supabase";
import {
  MagnifyingGlassIcon,
  PlusCircleIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";

type School = {
  id: string | number;
  name: string;
  status: "ativa" | "suspensa" | "pendente" | string;
  plan: "Enterprise" | "Premium" | "Básico" | string;
  lastAccess: string | null;
  students: number;
  teachers: number;
  city: string;
  state: string;
};

// ✅ Mock de segurança (usado se o fetch do Supabase não retornar nada)
const mockSchools: School[] = [
  { id: 1, name: "Escola Estadual Professor Silva", status: "ativa", plan: "Premium", lastAccess: "2023-11-15T14:30:00", students: 1250, teachers: 58, city: "São Paulo", state: "SP" },
  { id: 2, name: "Colégio Excelência", status: "ativa", plan: "Básico", lastAccess: "2023-11-14T09:15:00", students: 780, teachers: 32, city: "Rio de Janeiro", state: "RJ" },
  { id: 3, name: "Instituto Educacional Futuro", status: "suspensa", plan: "Enterprise", lastAccess: "2023-10-30T16:45:00", students: 2100, teachers: 95, city: "Belo Horizonte", state: "MG" },
  { id: 4, name: "Centro Educacional Primavera", status: "ativa", plan: "Premium", lastAccess: "2023-11-16T08:20:00", students: 950, teachers: 42, city: "Porto Alegre", state: "RS" },
  { id: 5, name: "Escola Técnica Municipal", status: "pendente", plan: "Básico", lastAccess: null, students: 0, teachers: 0, city: "Salvador", state: "BA" },
];

export default function SchoolsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [schools, setSchools] = useState<School[]>(mockSchools);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [planFilter, setPlanFilter] = useState<"all" | string>("all");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        // 🔒 (opcional) garantir que só super_admin acesse
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }

        // Busca básica da tabela escolas
        const { data, error } = await supabase
          .from("escolas")
          .select("id, nome, status, endereco")
          .order("nome", { ascending: true });

        if (error) console.warn("⚠️ Falha ao buscar escolas:", error.message);

        if (active && data && data.length) {
          type EscolaRow = Pick<Database["public"]["Tables"]["escolas"]["Row"], "id" | "nome" | "status" | "endereco">;
          const normalized: School[] = (data as EscolaRow[]).map((d) => ({
            id: d.id,
            name: d.nome ?? "Sem nome",
            status: d.status ?? "ativa",
            plan: "Básico",
            lastAccess: null,
            students: 0,
            teachers: 0,
            city: d.endereco ?? "",
            state: "",
          }));
          setSchools(normalized);
        }
      } catch (e) {
        console.error("Erro inesperado ao carregar escolas:", e);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [router, supabase]);

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        school.name.toLowerCase().includes(q) ||
        school.city.toLowerCase().includes(q) ||
        school.state.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || school.status === statusFilter;
      const matchesPlan = planFilter === "all" || school.plan === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [schools, searchTerm, statusFilter, planFilter]);

  const statusStyles: Record<string, string> = {
    ativa: "bg-green-100 text-green-800",
    suspensa: "bg-red-100 text-red-800",
    pendente: "bg-yellow-100 text-yellow-800",
  };

  const planStyles: Record<string, string> = {
    Enterprise: "bg-purple-100 text-purple-800",
    Premium: "bg-blue-100 text-blue-800",
    "Básico": "bg-gray-100 text-gray-800",
  };

  // 🔗 Ajuste principal: entrar no portal da escola em modo de auditoria (view-only)
  const enterSchoolPortal = (schoolId: string | number) => {
    router.push(`/escola/${schoolId}/dashboard?mode=view-only`);
  };

  // 🔎 Página de detalhes global (métrica/compliance) da escola (no escopo do Super Admin)
  const viewSchoolDetails = (schoolId: string | number) => {
    router.push(`/super-admin/escolas/${schoolId}`);
  };

  const totalStudents = useMemo(
    () => schools.reduce((sum, s) => sum + (Number.isFinite(s.students) ? s.students : 0), 0),
    [schools]
  );
  const totalTeachers = useMemo(
    () => schools.reduce((sum, s) => sum + (Number.isFinite(s.teachers) ? s.teachers : 0), 0),
    [schools]
  );

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-dark">Gestão de Escolas</h1>
          <p className="text-moxinexa-gray mt-1">Visualize e gerencie todas as escolas do sistema</p>
        </div>
        <button
          onClick={() => router.push("/super-admin/escolas/nova")}
          className="mt-4 md:mt-0 flex items-center gap-2 bg-moxinexa-teal hover:bg-moxinexa-teal-dark text-white px-4 py-2.5 rounded-lg transition-colors"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Nova Escola
        </button>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 border border-moxinexa-light/30">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-moxinexa-gray" />
            <input
              type="text"
              placeholder="Buscar por nome, cidade ou UF..."
              className="w-full pl-10 pr-4 py-2.5 bg-moxinexa-light/20 rounded-lg border border-moxinexa-light/30 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal/30 focus:border-moxinexa-teal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="px-4 py-2.5 bg-white rounded-lg border border-moxinexa-light/30 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal/30 focus:border-moxinexa-teal"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos os status</option>
              <option value="ativa">Ativa</option>
              <option value="suspensa">Suspensa</option>
              <option value="pendente">Pendente</option>
            </select>

            <select
              className="px-4 py-2.5 bg-white rounded-lg border border-moxinexa-light/30 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal/30 focus:border-moxinexa-teal"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
            >
              <option value="all">Todos os planos</option>
              <option value="Enterprise">Enterprise</option>
              <option value="Premium">Premium</option>
              <option value="Básico">Básico</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-moxinexa-light/30">
          <h3 className="text-sm text-moxinexa-gray">Total de Escolas</h3>
          <p className="text-2xl font-bold text-moxinexa-dark">{schools.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-moxinexa-light/30">
          <h3 className="text-sm text-moxinexa-gray">Escolas Ativas</h3>
          <p className="text-2xl font-bold text-moxinexa-dark">
            {schools.filter((s) => s.status === "ativa").length}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-moxinexa-light/30">
          <h3 className="text-sm text-moxinexa-gray">Total de Alunos</h3>
          <p className="text-2xl font-bold text-moxinexa-dark">{totalStudents}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-moxinexa-light/30">
          <h3 className="text-sm text-moxinexa-gray">Total de Professores</h3>
          <p className="text-2xl font-bold text-moxinexa-dark">{totalTeachers}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-moxinexa-light/30">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-moxinexa-light/10">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold text-moxinexa-gray">Nome da Escola</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-moxinexa-gray">Localização</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-moxinexa-gray">Status</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-moxinexa-gray">Plano</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-moxinexa-gray">Último Acesso</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-moxinexa-gray">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-moxinexa-light/20">
              {loading ? (
                // 💠 Skeleton simples
                [...Array(5)].map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td className="py-4 px-4"><div className="h-4 w-56 bg-moxinexa-light/30 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-28 bg-moxinexa-light/30 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-20 bg-moxinexa-light/30 rounded-full" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-24 bg-moxinexa-light/30 rounded-full" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-moxinexa-light/30 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-5 w-24 bg-moxinexa-light/30 rounded" /></td>
                  </tr>
                ))
              ) : (
                filteredSchools.map((school) => (
                  <tr key={school.id} className="hover:bg-moxinexa-light/5">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-moxinexa-dark">{school.name}</p>
                        <p className="text-sm text-moxinexa-gray">
                          {school.students} alunos · {school.teachers} professores
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-moxinexa-dark">{school.city}</p>
                      <p className="text-sm text-moxinexa-gray">{school.state}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[school.status] ?? "bg-gray-100 text-gray-800"}`}>
                        {school.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planStyles[school.plan] ?? "bg-gray-100 text-gray-800"}`}>
                        {school.plan}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-moxinexa-dark">
                        {school.lastAccess ? new Date(school.lastAccess).toLocaleDateString("pt-BR") : "Nunca acessou"}
                      </p>
                      <p className="text-sm text-moxinexa-gray">
                        {school.lastAccess && new Date(school.lastAccess).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewSchoolDetails(school.id)}
                          className="p-2 text-moxinexa-teal hover:bg-moxinexa-teal/10 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => enterSchoolPortal(school.id)}
                          className="p-2 text-moxinexa-navy hover:bg-moxinexa-navy/10 rounded-lg transition-colors"
                          title="Entrar no portal da escola (view-only)"
                        >
                          <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredSchools.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-moxinexa-gray">Nenhuma escola encontrada com os filtros aplicados.</p>
          </div>
        )}
      </div>

      {/* Paginação (placeholder) */}
      {!loading && (
        <div className="mt-6 flex justify-between items-center">
          <p className="text-sm text-moxinexa-gray">
            Mostrando {filteredSchools.length} de {schools.length} escolas
          </p>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm bg-white border border-moxinexa-light/30 rounded-lg text-moxinexa-gray hover:bg-moxinexa-light/10">
              Anterior
            </button>
            <button className="px-3 py-1.5 text-sm bg-moxinexa-teal text-white rounded-lg">1</button>
            <button className="px-3 py-1.5 text-sm bg-white border border-moxinexa-light/30 rounded-lg text-moxinexa-gray hover:bg-moxinexa-light/10">
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
