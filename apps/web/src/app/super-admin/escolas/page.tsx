"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import toast from "react-hot-toast"
import ConfigHealthBanner from "@/components/system/ConfigHealthBanner";
import {
  MagnifyingGlassIcon,
  PlusCircleIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  RocketLaunchIcon,
  EnvelopeIcon,
  BanknotesIcon,
  BoltIcon,
  NoSymbolIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { TrashIcon } from "@heroicons/react/24/solid";

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

type OnboardingProgress = {
  escola_id: string;
  nome: string | null;
  onboarding_finalizado: boolean;
  last_step: number | null;
  last_updated_at: string | null;
}

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const supabase = createClient();

  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [planFilter, setPlanFilter] = useState<"all" | string>("all");
  const [progress, setProgress] = useState<Record<string, OnboardingProgress>>({});
  const [fallbackSource, setFallbackSource] = useState<string | null>(null);
  const [onboardingFilter, setOnboardingFilter] = useState<'all' | 'done' | 'in_progress' | 'step1' | 'step2' | 'step3'>('all')
  const [billingOpen, setBillingOpen] = useState(false)
  const [billingForm, setBillingForm] = useState<{ escolaId: string | number | null; valor: string; vencimento: string }>({ escolaId: null, valor: '', vencimento: '' })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmData, setConfirmData] = useState<{ action: 'suspend' | 'reactivate' | 'delete' | null; escolaId: string | number | null; escolaNome: string }>({ action: null, escolaId: null, escolaNome: '' })
  const [confirmReason, setConfirmReason] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Exibe toast de sucesso quando vier de criação
  useEffect(() => {
    const created = searchParams?.get('created')
    const name = searchParams?.get('name')
    if (created === '1') {
      const pretty = name ? `Escola "${name}" criada com sucesso!` : 'Escola criada com sucesso!'
      toast.success(pretty)
      // limpa query params para evitar repetir o toast
      if (pathname) router.replace(pathname)
    }
  }, [searchParams, router, pathname])

  // Carrega lista + progresso (reutilizável em mount/focus/back)
  const loadData = async (activeRef: { current: boolean }) => {
      try {
        // 🔒 (opcional) garantir que só super_admin acesse (sem rede)
       const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  router.replace("/login");
  return;
}


        // Server API: lista de escolas (bypass RLS via service role)
        const res = await fetch('/api/super-admin/escolas/list', { cache: 'no-store' })
        const listJson = await res.json().catch(() => ({ ok: false }))
        if (activeRef.current && listJson?.ok && Array.isArray(listJson.items)) {
          type Item = { id: string; nome: string | null; status: string | null; plano: string | null; last_access: string | null; total_alunos: number; total_professores: number; cidade: string | null; estado: string | null }
          const prettyPlan = (p?: string | null): School['plan'] => {
            switch ((p || '').toLowerCase()) {
              case 'basico': return 'Básico'
              case 'standard': return 'Premium'
              case 'premium': return 'Enterprise'
              default: return (p as any) || 'Básico'
            }
          }
          const normalized: School[] = (listJson.items as Item[]).map(d => ({
            id: String(d.id),
            name: d.nome ?? 'Sem nome',
            status: (d.status ?? 'ativa') as School['status'],
            plan: prettyPlan(d.plano),
            lastAccess: d.last_access ?? null,
            students: Number(d.total_alunos ?? 0),
            teachers: Number(d.total_professores ?? 0),
            city: d.cidade ?? '',
            state: d.estado ?? '',
          }))
          setSchools(normalized)
          setErrorMsg(null)
          setFallbackSource(typeof (listJson as any).fallback === 'string' ? String((listJson as any).fallback) : null)
        } else if (!listJson?.ok) {
          // Evita erro ruidoso no console do Next DevTools; notifica via toast e segue fluxo.
          const detail = (listJson && typeof listJson === 'object' && 'error' in listJson) ? (listJson as any).error : undefined
          if (detail) {
            console.warn('[super-admin/escolas] Falha ao carregar lista de escolas via API:', detail)
            setErrorMsg(String(detail))
            setFallbackSource(null)
          } else {
            console.warn('[super-admin/escolas] Falha ao carregar lista de escolas via API')
            setErrorMsg('Falha ao carregar a lista de escolas.')
            setFallbackSource(null)
          }
          // Mantenha o toast curto e deixe os detalhes no painel visual
          toast.error('Não foi possível carregar as escolas.')
        }
        // Fetch onboarding progress for all schools (service route)
        const p = await fetch('/api/super-admin/escolas/onboarding/progress', { cache: 'no-store' })
          .then(r => r.json()).catch(() => ({ ok: false }))
        if (activeRef.current && p?.ok && Array.isArray(p.items)) {
          const map: Record<string, OnboardingProgress> = {}
          for (const it of p.items as OnboardingProgress[]) map[it.escola_id] = it
          setProgress(map)
        }
      } catch (e) {
        console.warn("[super-admin/escolas] Erro inesperado ao carregar escolas:", e);
        toast.error('Ocorreu um erro ao carregar os dados.');
      } finally {
        if (activeRef.current) setLoading(false);
      }
  }

  useEffect(() => {
    let active = { current: true }

    // carga inicial
    loadData(active)

    // Recarregar ao voltar (popstate) e ao focar a aba (focus/visibility)
    const onFocus = () => { if (active.current) loadData(active) }
    const onVisibility = () => { if (active.current && document.visibilityState === 'visible') loadData(active) }
    const onPopState = () => { if (active.current) loadData(active) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('popstate', onPopState)

    return () => {
      active.current = false
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('popstate', onPopState)
    }
  }, [router, supabase])

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

      // Onboarding filter
      const pr = progress[String(school.id)]
      const isDone = pr?.onboarding_finalizado === true
      const step = isDone ? 3 : Math.min(3, Math.max(1, Number(pr?.last_step ?? 1)))

      const matchesOnboarding = (() => {
        switch (onboardingFilter) {
          case 'done':
            return isDone
          case 'in_progress':
            return !isDone
          case 'step1':
            return !isDone && step === 1
          case 'step2':
            return !isDone && step === 2
          case 'step3':
            return isDone
          default:
            return true
        }
      })()

      return matchesSearch && matchesStatus && matchesPlan && matchesOnboarding;
    });
  }, [schools, searchTerm, statusFilter, planFilter, progress, onboardingFilter]);

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

  // Resumo do Onboarding
  const onboardingSummary = useMemo(() => {
    let done = 0, s1 = 0, s2 = 0, s3 = 0
    for (const s of schools) {
      const pr = progress[String(s.id)]
      if (pr?.onboarding_finalizado) { done++; s3++; continue }
      const step = Math.min(3, Math.max(1, Number(pr?.last_step ?? 1)))
      if (step === 1) s1++
      else if (step === 2) s2++
      else s3++
    }
    const inProgress = s1 + s2
    return { done, inProgress, s1, s2, s3 }
  }, [schools, progress])

  // 🔗 Ajuste principal: entrar no portal da escola em modo de auditoria (view-only)
  const enterSchoolPortal = (schoolId: string | number) => {
    router.push(`/escola/${schoolId}/dashboard?mode=view-only`);
  };

  // 🔎 Página de detalhes global (métrica/compliance) da escola (no escopo do Super Admin)
  const viewSchoolDetails = (schoolId: string | number) => {
    router.push(`/super-admin/escolas/${schoolId}/edit`);
  };

  const totalStudents = useMemo(
    () => schools.reduce((sum, s) => sum + (Number.isFinite(s.students) ? s.students : 0), 0),
    [schools]
  );
  const totalTeachers = useMemo(
    () => schools.reduce((sum, s) => sum + (Number.isFinite(s.teachers) ? s.teachers : 0), 0),
    [schools]
  );

  const sortedSchools = useMemo(() => {
    const arr = [...filteredSchools]
    arr.sort((a, b) => {
      const pa = progress[String(a.id)]
      const pb = progress[String(b.id)]
      const aDone = pa?.onboarding_finalizado === true
      const bDone = pb?.onboarding_finalizado === true
      // Em andamento primeiro
      if (aDone !== bDone) return aDone ? 1 : -1
      // Entre em andamento, etapas menores primeiro (1 antes de 2)
      const aStep = aDone ? 3 : Math.min(3, Math.max(1, Number(pa?.last_step ?? 1)))
      const bStep = bDone ? 3 : Math.min(3, Math.max(1, Number(pb?.last_step ?? 1)))
      if (aStep !== bStep) return aStep - bStep
      // Fallback: nome
      return a.name.localeCompare(b.name)
    })
    return arr
  }, [filteredSchools, progress])

  // Paginação
  const totalPages = Math.ceil(filteredSchools.length / itemsPerPage)
  const paginatedSchools = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedSchools.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedSchools, currentPage])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ConfigHealthBanner />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {errorMsg && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <div className="font-semibold">Falha ao carregar escolas</div>
            <div className="mt-1 text-sm break-words">{errorMsg}</div>
            <div className="mt-2 text-xs">
              Dicas:
              <ul className="list-disc ml-5 mt-1 space-y-0.5">
                <li>Verifique <a className="underline" href="/api/health" target="_blank" rel="noreferrer">/api/health</a> para confirmar variáveis de ambiente.</li>
                <li>Exigidas: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.</li>
                <li>Confirme que seu usuário tem papel <code>super_admin</code> na tabela <code>profiles</code>.</li>
                <li>Se estiver em dev, aplique as migrações para criar a view <code>public.escolas_view</code>. Há fallback automático para a tabela <code>escolas</code>.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Gestão de Escolas
              {fallbackSource && (
                <span
                  title="Fallback ativo: usando tabela básica por ausência da view. Contagens podem ser aproximadas."
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                >
                  Fallback ativo
                </span>
              )}
            </h1>
            <p className="text-gray-600 mt-1">Visualize e gerencie todas as escolas do sistema</p>
          </div>
          <button
            onClick={() => router.push("/super-admin/escolas/nova")}
            className="mt-4 md:mt-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            <PlusCircleIcon className="w-5 h-5" />
            Nova Escola
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, cidade..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 md:flex gap-2">
              <select
                className="px-3 py-2.5 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos status</option>
                <option value="ativa">Ativa</option>
                <option value="suspensa">Suspensa</option>
                <option value="pendente">Pendente</option>
              </select>

              <select
                className="px-3 py-2.5 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-sm"
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
              >
                <option value="all">Todos planos</option>
                <option value="Enterprise">Enterprise</option>
                <option value="Premium">Premium</option>
                <option value="Básico">Básico</option>
              </select>

              <select
                className="px-3 py-2.5 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-sm"
                value={onboardingFilter}
                onChange={(e) => setOnboardingFilter(e.target.value as any)}
              >
                <option value="all">Todos onboarding</option>
                <option value="done">Concluído</option>
                <option value="in_progress">Em andamento</option>
                <option value="step1">Etapa 1</option>
                <option value="step2">Etapa 2</option>
                <option value="step3">Etapa 3</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <h3 className="text-sm text-gray-600 font-medium">Total de Escolas</h3>
            <p className="text-2xl font-bold text-gray-900 mt-1">{schools.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <h3 className="text-sm text-gray-600 font-medium">Escolas Ativas</h3>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {schools.filter((s) => s.status === "ativa").length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <h3 className="text-sm text-gray-600 font-medium">Total de Alunos</h3>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalStudents}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <h3 className="text-sm text-gray-600 font-medium">Total de Professores</h3>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalTeachers}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <h3 className="text-sm text-gray-600 font-medium">Onboarding</h3>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">{onboardingSummary.done} concluído</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{onboardingSummary.inProgress} em andamento</span>
            </div>
          </div>
        </div>

        {/* Progresso do Onboarding */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Progresso do Onboarding</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{onboardingSummary.s1}</div>
              <div className="text-xs text-gray-500 mt-1">Etapa 1</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{onboardingSummary.s2}</div>
              <div className="text-xs text-gray-500 mt-1">Etapa 2</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{onboardingSummary.s3}</div>
              <div className="text-xs text-gray-500 mt-1">Etapa 3</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{onboardingSummary.done}</div>
              <div className="text-xs text-gray-500 mt-1">Concluído</div>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Escola</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Localização</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onboarding</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plano</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Acesso</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  // Skeleton loading
                  [...Array(5)].map((_, i) => (
                    <tr key={`sk-${i}`}>
                      <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" /></td>
                      <td className="py-4 px-4"><div className="h-6 bg-gray-200 rounded-full animate-pulse w-16" /></td>
                      <td className="py-4 px-4"><div className="h-6 bg-gray-200 rounded-full animate-pulse w-24" /></td>
                      <td className="py-4 px-4"><div className="h-6 bg-gray-200 rounded-full animate-pulse w-20" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded animate-pulse w-24" /></td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : paginatedSchools.length > 0 ? (
                  paginatedSchools.map((school) => {
                    const pr = progress[String(school.id)]
                    const rowHighlight = pr && !pr.onboarding_finalizado
                    return (
                    <tr key={school.id} className={`${rowHighlight ? 'bg-amber-50' : ''} hover:bg-gray-50/50 transition-colors`}>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900 flex items-center gap-2">
                            {school.name}
                            {school.status === 'suspensa' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-800">
                                Suspensa
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {school.students} alunos · {school.teachers} professores
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-gray-900">{school.city}</p>
                        <p className="text-sm text-gray-500">{school.state}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[school.status] ?? "bg-gray-100 text-gray-800"}`}>
                          {school.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {(() => {
                          const pr = progress[String(school.id)]
                          if (!pr) return <span className="text-xs text-gray-400">—</span>
                          if (pr.onboarding_finalizado) {
                            return (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Concluído
                              </span>
                            )
                          }
                          const rawStep = pr.last_step ? Number(pr.last_step) : 1
                          const step = Math.min(3, Math.max(1, rawStep))
                          const pct = Math.round((step / 3) * 100)
                          return (
                            <button
                              type="button"
                              onClick={() => router.push(`/escola/${school.id}/onboarding`)}
                              className="min-w-[140px] text-left cursor-pointer hover:opacity-90 transition-opacity"
                              title="Abrir onboarding da escola"
                            >
                              <div className="text-sm text-gray-900">
                                Etapa {step}/3 {pr.last_updated_at ? (
                                  <span className="text-xs text-gray-500">· {new Date(pr.last_updated_at).toLocaleDateString('pt-BR')}</span>
                                ) : null}
                              </div>
                              <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden" aria-label="Progresso do onboarding" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                              </div>
                            </button>
                          )
                        })()}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planStyles[school.plan] ?? "bg-gray-100 text-gray-800"}`}>
                          {school.plan}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-gray-900">
                          {school.lastAccess ? new Date(school.lastAccess).toLocaleDateString("pt-BR") : "Nunca acessou"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {school.lastAccess && new Date(school.lastAccess).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          {/* Continuar Onboarding quando não finalizado */}
                          {(() => {
                            const pr = progress[String(school.id)]
                            if (pr && !pr.onboarding_finalizado) {
                              return (
                                <button
                                  onClick={() => router.push(`/escola/${school.id}/onboarding`)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                                  title="Continuar onboarding"
                                >
                                  <RocketLaunchIcon className="w-4 h-4" />
                                </button>
                              )
                            }
                            return null
                          })()}
                          <button
                            onClick={() => viewSchoolDetails(school.id)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                            title="Ver detalhes"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          {/* Enviar e-mail de cobrança (abre modal) */}
                          <button
                            onClick={() => {
                              if (school.status === 'suspensa') return
                              setBillingForm({ escolaId: school.id, valor: '', vencimento: '' });
                              setBillingOpen(true)
                            }}
                            className={`p-1.5 rounded-md transition-colors ${school.status === 'suspensa' ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:bg-green-100'}`}
                            title={school.status === 'suspensa' ? 'Indisponível: escola suspensa' : 'Enviar e-mail de cobrança'}
                            disabled={school.status === 'suspensa'}
                          >
                            <BanknotesIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if (school.status !== 'suspensa') enterSchoolPortal(school.id) }}
                            className={`p-1.5 rounded-md transition-colors ${school.status === 'suspensa' ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-100'}`}
                            title={school.status === 'suspensa' ? 'Indisponível: escola suspensa' : 'Entrar no portal da escola (view-only)'}
                            disabled={school.status === 'suspensa'}
                          >
                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                          </button>
                          {/* Reenviar convite de onboarding para o admin */}
                          {(() => {
                            const pr = progress[String(school.id)]
                            if (pr?.onboarding_finalizado) return null
                            return (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/super-admin/escolas/${school.id}/resend-invite`, { method: 'POST' })
                                    const json = await res.json()
                                    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao reenviar')
                                    const msg = String(json.mensagem || 'Convite reenviado.')
                                    toast.success(msg)
                                  } catch (e) {
                                    const m = e instanceof Error ? e.message : String(e)
                                    toast.error(`Erro: ${m}`)
                                  }
                                }}
                                className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-md transition-colors"
                                title="Reenviar convite de onboarding"
                              >
                                <EnvelopeIcon className="w-4 h-4" />
                              </button>
                            )
                          })()}
                          {/* Reativar/Suspender escola */}
                          {school.status === 'suspensa' ? (
                            <button
                              onClick={() => { setConfirmData({ action: 'reactivate', escolaId: school.id, escolaNome: school.name }); setConfirmReason(''); setConfirmOpen(true) }}
                              className="p-1.5 text-green-600 hover:bg-green-100 rounded-md transition-colors"
                              title="Reativar escola"
                            >
                              <BoltIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => { setConfirmData({ action: 'suspend', escolaId: school.id, escolaNome: school.name }); setConfirmReason(''); setConfirmOpen(true) }}
                              className="p-1.5 text-yellow-600 hover:bg-yellow-100 rounded-md transition-colors"
                              title="Suspender escola"
                            >
                              <NoSymbolIcon className="w-4 h-4" />
                            </button>
                          )}
                          {/* Excluir escola */}
                          <button
                            onClick={() => { setConfirmData({ action: 'delete', escolaId: school.id, escolaNome: school.name }); setConfirmReason(''); setConfirmOpen(true) }}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                            title="Eliminar escola"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <p className="text-gray-500">Nenhuma escola encontrada com os filtros aplicados.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {!loading && filteredSchools.length > 0 && (
            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, filteredSchools.length)}
                    </span> de{' '}
                    <span className="font-medium">{filteredSchools.length}</span> escolas
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`relative inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-md ${
                          currentPage === pageNum
                            ? 'z-10 bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de cobrança */}
      {billingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Enviar e-mail de cobrança</h3>
            <p className="text-sm text-gray-600 mb-4">Preencha os campos abaixo (opcionais) e confirme o envio.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Valor</label>
                <input
                  value={billingForm.valor}
                  onChange={(e) => setBillingForm((f) => ({ ...f, valor: e.target.value }))}
                  placeholder="Ex: R$ 499,00"
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Vencimento</label>
                <input
                  value={billingForm.vencimento}
                  onChange={(e) => setBillingForm((f) => ({ ...f, vencimento: e.target.value }))}
                  placeholder="Ex: 30/09/2025"
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setBillingOpen(false)}
                className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >Cancelar</button>
              <button
                onClick={async () => {
                  try {
                    if (!billingForm.escolaId) throw new Error('Escola inválida')
                    const res = await fetch(`/api/super-admin/escolas/${billingForm.escolaId}/billing-email`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ valor: billingForm.valor || undefined, vencimento: billingForm.vencimento || undefined })
                    })
                    const json = await res.json()
                    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao enviar cobrança')
                    const c = Number(json?.sentCount || 0)
                    toast.success(c > 1 ? `Cobrança enviada para ${c} destinatários.` : 'Cobrança enviada.')
                    setBillingOpen(false)
                  } catch (e) {
                    const m = e instanceof Error ? e.message : String(e)
                    toast.error(`Erro: ${m}`)
                  }
                }}
                className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >Enviar</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de confirmação (suspender/reativar) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmar ação</h3>
            <p className="text-sm text-gray-600">
              {confirmData.action === 'suspend' && (
                <>Deseja realmente suspender a escola <strong>{confirmData.escolaNome}</strong>? Usuários perderão o acesso até reativação.</>
              )}
              {confirmData.action === 'reactivate' && (
                <>Deseja reativar a escola <strong>{confirmData.escolaNome}</strong>? O acesso será restabelecido.</>
              )}
              {confirmData.action === 'delete' && (
                <>
                  <span className="text-red-600 font-semibold">Atenção:</span> Esta ação elimina a escola <strong>{confirmData.escolaNome}</strong>.
                  Dependendo de vínculos existentes, pode ser aplicada exclusão definitiva ou marcação como excluída.
                </>
              )}
            </p>
            {confirmData.action === 'suspend' && (
              <div className="mt-4">
                <label className="block text-sm text-gray-700 mb-1">Motivo (opcional)</label>
                <textarea
                  value={confirmReason}
                  onChange={(e) => setConfirmReason(e.target.value)}
                  placeholder="Ex: Inadimplência, auditoria em andamento, solicitação da escola, etc."
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >Cancelar</button>
              <button
                onClick={async () => {
                  try {
                    if (!confirmData.escolaId || !confirmData.action) throw new Error('Ação inválida')
                    if (confirmData.action === 'delete') {
                      const res = await fetch(`/api/super-admin/escolas/${confirmData.escolaId}/delete`, { method: 'DELETE' })
                      const json = await res.json()
                      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao eliminar escola')
                      setSchools(prev => prev.filter(s => s.id !== confirmData.escolaId))
                      toast.success(json.mode === 'soft' ? 'Escola marcada como excluída' : 'Escola eliminada')
                      setConfirmOpen(false)
                      return
                    }
                    const path = confirmData.action === 'suspend' ? 'suspend' : 'reactivate'
                    const init: RequestInit = confirmData.action === 'suspend'
                      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: confirmReason || undefined }) }
                      : { method: 'POST' }
                    const res = await fetch(`/api/super-admin/escolas/${confirmData.escolaId}/${path}`, init)
                    const json = await res.json()
                    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha na operação')
                    if (confirmData.action === 'suspend') {
                      setSchools(prev => prev.map(s => s.id === confirmData.escolaId ? { ...s, status: 'suspensa' } : s))
                      toast.success('Escola suspensa')
                    } else {
                      setSchools(prev => prev.map(s => s.id === confirmData.escolaId ? { ...s, status: 'ativa' } : s))
                      toast.success('Escola reativada')
                    }
                    setConfirmOpen(false)
                  } catch (e) {
                    const m = e instanceof Error ? e.message : String(e)
                    toast.error(`Erro: ${m}`)
                  }
                }}
                className={`px-3 py-2 text-sm rounded-md text-white ${confirmData.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}