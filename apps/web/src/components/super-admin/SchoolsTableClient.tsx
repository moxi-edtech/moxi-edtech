"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import ConfigHealthBanner from "@/components/system/ConfigHealthBanner";
const BillingModal = dynamic(() => import("@/components/super-admin/SchoolBillingModal"))
const ConfirmModal = dynamic(() => import("@/components/super-admin/ConfirmActionModal"))
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

type Props = {
  initialSchools: School[];
  initialProgress: Record<string, OnboardingProgress>;
  initialErrorMsg?: string | null;
  fallbackSource?: string | null;
}

export default function SchoolsTableClient({ initialSchools, initialProgress, initialErrorMsg, fallbackSource }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialErrorMsg ?? null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [planFilter, setPlanFilter] = useState<"all" | string>("all");
  const [progress, setProgress] = useState<Record<string, OnboardingProgress>>(initialProgress);
  const [billingOpen, setBillingOpen] = useState(false)
  const [billingSchoolId, setBillingSchoolId] = useState<string | number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmData, setConfirmData] = useState<{ action: 'suspend' | 'reactivate' | 'delete' | null; escolaId: string | number | null; escolaNome: string }>({ action: null, escolaId: null, escolaNome: '' })
  const [confirmReason, setConfirmReason] = useState('')
  const [onboardingFilter, setOnboardingFilter] = useState<'all' | 'done' | 'in_progress' | 'step1' | 'step2' | 'step3'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Reparar admins: chama API para criar/vincular admin ausente
  const runRepair = async (dryRun: boolean) => {
    const msg = dryRun
      ? 'Executar varredura (DRY-RUN) para detectar escolas sem admin? Nenhuma alteração será feita.'
      : 'Executar reparo de admins agora? Isto pode criar usuários e vínculos.'
    if (!window.confirm(msg)) return
    try {
      setLoading(true)
      const p = fetch('/api/super-admin/escolas/repair-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      }).then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok || !j?.ok) throw new Error(j?.error || 'Falha no reparo')
        return j
      })
      const res = await toast.promise(p, {
        loading: dryRun ? 'Analisando escolas…' : 'Reparando admins…',
        success: (j) => {
          const ok = (j?.results || []).filter((x: any) => x.status === 'ok').length
          const skipped = (j?.results || []).filter((x: any) => x.status === 'skipped').length
          const failed = (j?.results || []).filter((x: any) => x.status === 'failed').length
          return dryRun
            ? `DRY-RUN concluído: ${ok} ok, ${skipped} ignoradas, ${failed} falhas.`
            : `Reparo concluído: ${ok} ok, ${skipped} ignoradas, ${failed} falhas.`
        },
        error: (e) => (e instanceof Error ? e.message : 'Falha no reparo'),
      })
      // Após reparo efetivo, atualiza lista
      if (!dryRun) {
        const activeRef = { current: true }
        await reload(activeRef)
      }
    } catch (_) {
      // toast já exibido
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const created = searchParams?.get('created')
    const name = searchParams?.get('name')
    if (created === '1') {
      const pretty = name ? `Escola "${name}" criada com sucesso!` : 'Escola criada com sucesso!'
      toast.success(pretty)
      if (pathname) router.replace(pathname)
    }
  }, [searchParams, router, pathname])

  const reload = async (activeRef: { current: boolean }) => {
    try {
      setLoading(true)
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
      } else if (!listJson?.ok) {
        const detail = (listJson && typeof listJson === 'object' && 'error' in listJson) ? (listJson as any).error : undefined
        if (detail) {
          console.warn('[super-admin/escolas] Falha ao carregar lista de escolas via API:', detail)
          setErrorMsg(String(detail))
        } else {
          console.warn('[super-admin/escolas] Falha ao carregar lista de escolas via API')
          setErrorMsg('Falha ao carregar a lista de escolas.')
        }
        toast.error('Não foi possível carregar as escolas.')
      }

      const p = await fetch('/api/super-admin/escolas/onboarding/progress', { cache: 'no-store' })
        .then(r => r.json()).catch(() => ({ ok: false }))
      if (activeRef.current && p?.ok && Array.isArray(p.items)) {
        const map: Record<string, OnboardingProgress> = {}
        for (const it of p.items as OnboardingProgress[]) map[it.escola_id] = it
        setProgress(map)
      }
    } catch (e) {
      console.warn("[super-admin/escolas] Erro inesperado ao recarregar escolas:", e);
      toast.error('Ocorreu um erro ao recarregar os dados.');
    } finally {
      activeRef.current && setLoading(false)
    }
  }

  const handleRetry = async () => {
    // Usa um ref efêmero apenas para esta chamada
    await reload({ current: true })
  }

  useEffect(() => {
    let active = { current: true }
    const onFocus = () => { if (active.current) reload(active) }
    const onVisibility = () => { if (active.current && document.visibilityState === 'visible') reload(active) }
    const onPopState = () => { if (active.current) reload(active) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('popstate', onPopState)

    return () => {
      active.current = false
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

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

      const pr = progress[String(school.id)]
      const isDone = pr?.onboarding_finalizado === true
      const step = isDone ? 3 : Math.min(3, Math.max(1, Number(pr?.last_step ?? 1)))
      const matchesOnboarding = (() => {
        switch (onboardingFilter) {
          case 'done': return isDone
          case 'in_progress': return !isDone
          case 'step1': return !isDone && step === 1
          case 'step2': return !isDone && step === 2
          case 'step3': return isDone
          default: return true
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
      if (aDone !== bDone) return aDone ? 1 : -1
      const aStep = aDone ? 3 : Math.min(3, Math.max(1, Number(pa?.last_step ?? 1)))
      const bStep = bDone ? 3 : Math.min(3, Math.max(1, Number(pb?.last_step ?? 1)))
      if (aStep !== bStep) return aStep - bStep
      return a.name.localeCompare(b.name)
    })
    return arr
  }, [filteredSchools, progress])

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

  const enterSchoolPortal = (schoolId: string | number) => {
    router.push(`/escola/${schoolId}/dashboard?mode=view-only`);
  };
  const viewSchoolDetails = (schoolId: string | number) => {
    router.push(`/super-admin/escolas/${schoolId}/edit`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <ConfigHealthBanner />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {errorMsg && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <div className="font-semibold">Falha ao carregar escolas</div>
            <div className="mt-1 text-sm break-words">{errorMsg}</div>

            <div className="mt-3">
              <button
                type="button"
                onClick={handleRetry}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                title="Tentar carregar novamente"
              >
                {loading ? 'Recarregando…' : 'Tentar novamente'}
              </button>
            </div>

            {/* Contextual actions based on error */}
            {(() => {
              const msg = (errorMsg || '').toLowerCase()
              const isUnauthorized = /não autenticado|nao autenticado|not authenticated/.test(msg)
              const isForbidden = /somente\s*super[_\s-]?admin|forbidden|sem permissão/.test(msg)

              if (isUnauthorized) {
                return (
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <a
                      href={`/login?next=${encodeURIComponent('/super-admin/escolas')}`}
                      className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Fazer login
                    </a>
                    <a
                      href="/admin-seed"
                      className="inline-flex items-center px-3 py-2 rounded-md bg-slate-800 text-white hover:bg-slate-900"
                    >
                      Criar Super Admin (dev)
                    </a>
                  </div>
                )
              }

              if (isForbidden) {
                return (
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <span className="inline-flex items-center px-3 py-2 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                      Acesso restrito a Super Admin
                    </span>
                    <a
                      href="/super-admin/debug"
                      className="inline-flex items-center px-3 py-2 rounded-md bg-slate-200 text-slate-900 hover:bg-slate-300"
                    >
                      Ver Debug de Sessão
                    </a>
                    <a
                      href={`/login?next=${encodeURIComponent('/super-admin/escolas')}`}
                      className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Trocar usuário
                    </a>
                  </div>
                )
              }
              return null
            })()}

            {/* Generic tips always visible as fallback guidance */}
            <div className="mt-3 text-xs">
              Dicas:
              <ul className="list-disc ml-5 mt-1 space-y-0.5">
                <li>Verifique <a className="underline" href="/api/health" target="_blank" rel="noreferrer">/api/health</a> para confirmar variáveis de ambiente.</li>
                <li>Exigidas: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.</li>
                <li>Confirme que seu usuário tem papel <code>super_admin</code> na tabela <code>profiles</code>.</li>
                <li>Se estiver em dev, aplique as migrações para criar a view <code>public.escolas_view</code>. Há fallback automático para a tabela <code>escolas</code>.</li>
                {process.env.NODE_ENV !== 'production' && (
                  <li>
                    Em desenvolvimento, você pode usar <a className="underline" href="/admin-seed" target="_blank" rel="noreferrer">/admin-seed</a> para criar/recriar um Super Admin padrão.
                  </li>
                )}
                <li>
                  Para inspecionar sessão e cookies, acesse <a className="underline" href="/super-admin/debug" target="_blank" rel="noreferrer">/super-admin/debug</a>.
                </li>
              </ul>
            </div>
          </div>
        )}

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => runRepair(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
              title="Simular reparo: não altera dados"
            >
              <BoltIcon className="w-5 h-5" /> Reparar Admins (Dry‑Run)
            </button>
            <button
              onClick={() => runRepair(false)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-green-300 text-green-900 bg-green-50 hover:bg-green-100"
              title="Executa reparo: cria usuários/vínculos se necessário"
            >
              <BoltIcon className="w-5 h-5" /> Reparar Admins
            </button>
            <button
              onClick={() => router.push("/super-admin/escolas/nova")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              <PlusCircleIcon className="w-5 h-5" /> Nova Escola
            </button>
          </div>
        </div>

        {/* Filtros e resumo */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2 top-2.5" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou cidade"
                  className="pl-8 pr-3 py-2 border rounded-md text-sm w-64"
                />
              </div>
              <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="border rounded px-2 py-2 text-sm">
                <option value="all">Todos status</option>
                <option value="ativa">Ativa</option>
                <option value="pendente">Pendente</option>
                <option value="suspensa">Suspensa</option>
              </select>
              <select value={planFilter} onChange={(e)=>setPlanFilter(e.target.value)} className="border rounded px-2 py-2 text-sm">
                <option value="all">Todos planos</option>
                <option value="Básico">Básico</option>
                <option value="Premium">Premium</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
            <div className="text-sm text-gray-600 flex gap-4">
              <span>{totalStudents} alunos</span>
              <span>{totalTeachers} professores</span>
              <span>{onboardingSummary.inProgress} em onboarding</span>
              <span>{onboardingSummary.done} concluído</span>
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
                    const rawStep = pr?.last_step ? Number(pr.last_step) : 1
                    const step = Math.min(3, Math.max(1, rawStep))
                    const pct = Math.round((step / 3) * 100)
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
                        {pr ? (
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
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
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
                          {school.lastAccess ? new Date(school.lastAccess).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
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
                          <button
                            onClick={() => {
                              if (school.status === 'suspensa') return
                              setBillingSchoolId(school.id);
                              setBillingOpen(true)
                            }}
                            className={`p-1.5 rounded-md transition-colors ${school.status === 'suspensa' ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:bg-green-100'}`}
                            title={school.status === 'suspensa' ? 'Indisponível: escola suspensa' : 'Enviar cobrança'}
                          >
                            <EnvelopeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => enterSchoolPortal(school.id)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                            title="Entrar no portal (view-only)"
                          >
                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setConfirmData({ action: 'suspend', escolaId: school.id, escolaNome: school.name }); setConfirmOpen(true); }}
                            className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-md transition-colors"
                            title="Suspender escola"
                          >
                            <NoSymbolIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setConfirmData({ action: 'delete', escolaId: school.id, escolaNome: school.name }); setConfirmOpen(true); }}
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
                    <td colSpan={7} className="py-8 text-center text-gray-500">Nenhuma escola encontrada</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginação */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-2 py-1 rounded border disabled:opacity-50">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="text-sm">Página {currentPage} de {Math.max(1, totalPages)}</span>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-2 py-1 rounded border disabled:opacity-50">
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal de cobrança (dynamic) */}
      {billingOpen && billingSchoolId != null && (
        <BillingModal escolaId={billingSchoolId} onClose={() => { setBillingOpen(false); setBillingSchoolId(null); }} />
      )}

      {/* Modal de confirmação (dynamic) */}
      {confirmOpen && confirmData.action && confirmData.escolaId != null && (
        <ConfirmModal
          action={confirmData.action}
          escolaId={confirmData.escolaId}
          escolaNome={confirmData.escolaNome}
          onClose={() => setConfirmOpen(false)}
          onChanged={(newStatus, mode) => {
            if (confirmData.action === 'delete') {
              setSchools(prev => prev.filter(s => s.id !== confirmData.escolaId))
            } else if (newStatus) {
              setSchools(prev => prev.map(s => s.id === confirmData.escolaId ? { ...s, status: newStatus } : s))
            }
          }}
        />
      )}
    </div>
  )
}
